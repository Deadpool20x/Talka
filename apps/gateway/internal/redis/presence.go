package redis

import (
	"encoding/json"
	"time"
)

// PresenceUpdate is the payload published to presence:broadcast (EVENT_PROTOCOL.md §4.4).
// All Gateway instances subscribe to this channel to keep their in-memory
// user→socket maps consistent across horizontal instances.
type PresenceUpdate struct {
	UserID   string `json:"user_id"`
	Status   string `json:"status"`               // "online" | "offline"
	LastSeen string `json:"last_seen,omitempty"` // ISO 8601 UTC
}

// SetUserOnline writes the user to the presence hash, refreshes the heartbeat
// key, then broadcasts a PresenceUpdate{status:"online"} to all Gateway instances.
func (c *Client) SetUserOnline(userID string, ttl time.Duration) error {
	if err := c.SetUserSocket(userID, "online", ttl); err != nil {
		return err
	}
	payload, _ := json.Marshal(PresenceUpdate{
		UserID:   userID,
		Status:   "online",
		LastSeen: time.Now().UTC().Format(time.RFC3339),
	})
	return c.PublishPresence(payload)
}

// SetUserOffline removes the user from the presence hash and broadcasts a
// PresenceUpdate{status:"offline"} to all Gateway instances.
// Called after the grace period expires with no reconnection.
func (c *Client) SetUserOffline(userID string) error {
	if err := c.DeleteUserSocket(userID); err != nil {
		return err
	}
	payload, _ := json.Marshal(PresenceUpdate{
		UserID:   userID,
		Status:   "offline",
		LastSeen: time.Now().UTC().Format(time.RFC3339),
	})
	return c.PublishPresence(payload)
}
