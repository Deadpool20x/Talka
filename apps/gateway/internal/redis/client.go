// Package redis wraps go-redis/v9 for the Chat-OS Gateway.
// Key patterns are frozen by EVENT_PROTOCOL.md §4.
package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// keyUserSocketMap is the Redis hash that maps userId → socketId (presence registry).
// Pattern: EVENT_PROTOCOL.md §4 — user_socket_map
const keyUserSocketMap = "user_socket_map"

// keyHeartbeatPrefix is prepended to userId for per-user heartbeat TTL keys.
// Pattern: heartbeat:{userId}
const keyHeartbeatPrefix = "heartbeat:"

// keyRoomPrefix is the Pub/Sub channel prefix for conversation rooms.
// Pattern: EVENT_PROTOCOL.md §4.3 — room:{conversationId}
const keyRoomPrefix = "room:"

// keyPresenceBroadcast is the Pub/Sub channel for cross-instance presence propagation.
// Pattern: EVENT_PROTOCOL.md §4.4 — presence:broadcast
const keyPresenceBroadcast = "presence:broadcast"

// StreamMessagesIncoming is the Redis Stream key for inbound chat messages.
// Pattern: EVENT_PROTOCOL.md §4.1 — stream:messages:incoming
const StreamMessagesIncoming = "stream:messages:incoming"

// StreamPresenceUpdates is the Redis Stream key for presence analytics.
// Pattern: EVENT_PROTOCOL.md §4.2 — stream:presence:updates
const StreamPresenceUpdates = "stream:presence:updates"

// Client wraps go-redis with gateway-specific helper methods.
// ctx is stored on the struct to keep call-sites clean; for request-scoped
// cancellation Prompt 3C will thread contexts through the connection handler.
type Client struct {
	rdb *redis.Client
	ctx context.Context
}

// NewClient parses redisURL, creates a go-redis Client, and pings to confirm connectivity.
func NewClient(redisURL string) (*Client, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}

	rdb := redis.NewClient(opt)
	ctx := context.Background()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping: %w", err)
	}

	return &Client{rdb: rdb, ctx: ctx}, nil
}

// Close releases the underlying Redis connection pool.
func (c *Client) Close() error {
	return c.rdb.Close()
}

// ---------------------------------------------------------------------------
// Presence: userId ↔ socketId mapping
// Uses a single Redis Hash so all online users are visible in O(1) per lookup.
// ---------------------------------------------------------------------------

// SetUserSocket writes userId → socketId into the presence hash with a TTL on
// a companion heartbeat key (the hash itself has no TTL — cleanup is explicit).
func (c *Client) SetUserSocket(userID, socketID string, ttl time.Duration) error {
	if err := c.rdb.HSet(c.ctx, keyUserSocketMap, userID, socketID).Err(); err != nil {
		return fmt.Errorf("set user socket: %w", err)
	}
	// Companion heartbeat key lets callers detect stale entries if explicit
	// cleanup is missed (e.g. crash without graceful shutdown).
	return c.SetUserHeartbeat(userID, ttl)
}

// GetUserSocket retrieves the socketId for a userId.
// Returns redis.Nil if the user is not online.
func (c *Client) GetUserSocket(userID string) (string, error) {
	return c.rdb.HGet(c.ctx, keyUserSocketMap, userID).Result()
}

// DeleteUserSocket removes a userId from the presence hash and deletes the
// companion heartbeat key.
func (c *Client) DeleteUserSocket(userID string) error {
	if err := c.rdb.HDel(c.ctx, keyUserSocketMap, userID).Err(); err != nil {
		return fmt.Errorf("delete user socket: %w", err)
	}
	// Clean up heartbeat key — ignore not-found errors
	_ = c.rdb.Del(c.ctx, keyHeartbeatPrefix+userID).Err()
	return nil
}

// SetUserHeartbeat refreshes the heartbeat TTL key for a userId.
// Called on every heartbeat event from the client.
func (c *Client) SetUserHeartbeat(userID string, ttl time.Duration) error {
	return c.rdb.Set(c.ctx, keyHeartbeatPrefix+userID, "1", ttl).Err()
}

// ---------------------------------------------------------------------------
// Pub/Sub — room channels (EVENT_PROTOCOL.md §4.3)
// ---------------------------------------------------------------------------

// PublishToRoom publishes a serialised event payload to room:{roomId}.
// Called by the Gateway after forwarding a typing event, and by the API
// worker after persisting a message.
func (c *Client) PublishToRoom(roomID string, payload []byte) error {
	return c.rdb.Publish(c.ctx, keyRoomPrefix+roomID, payload).Err()
}

// SubscribeToRoom returns a Pub/Sub subscription for room:{roomId}.
// The caller is responsible for reading the channel and closing the PubSub.
func (c *Client) SubscribeToRoom(roomID string) *redis.PubSub {
	return c.rdb.Subscribe(c.ctx, keyRoomPrefix+roomID)
}

// ---------------------------------------------------------------------------
// Pub/Sub — presence broadcast channel (EVENT_PROTOCOL.md §4.4)
// ---------------------------------------------------------------------------

// PublishPresence publishes a presence update to all Gateway instances.
func (c *Client) PublishPresence(payload []byte) error {
	return c.rdb.Publish(c.ctx, keyPresenceBroadcast, payload).Err()
}

// SubscribePresence returns a Pub/Sub subscription for presence:broadcast.
func (c *Client) SubscribePresence() *redis.PubSub {
	return c.rdb.Subscribe(c.ctx, keyPresenceBroadcast)
}

// ---------------------------------------------------------------------------
// Redis Streams (EVENT_PROTOCOL.md §4.1, §4.2)
// ---------------------------------------------------------------------------

// AddToStream appends an entry to a Redis Stream.
// streamKey should be one of the StreamMessages* or StreamPresence* constants.
func (c *Client) AddToStream(streamKey string, values map[string]interface{}) error {
	return c.rdb.XAdd(c.ctx, &redis.XAddArgs{
		Stream: streamKey,
		Values: values,
	}).Err()
}
