// Package ws provides the WebSocket server for the Chat-OS gateway.
package ws

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"chat-os/gateway/internal/config"
	"chat-os/gateway/internal/protocol"
	"chat-os/gateway/internal/redis"
	"chat-os/gateway/internal/utils"
)

// Server is the central WebSocket connection manager.
// One Server instance runs per gateway process; it owns the connection registry
// and communicates with Redis for presence and pub/sub.
type Server struct {
	config      *config.Config
	logger      *utils.Logger
	redis       *redis.Client
	upgrader    websocket.Upgrader
	connections map[string]*Connection // userId → active Connection
	register    chan *Connection
	unregister  chan *Connection
	mu          sync.RWMutex
}

// NewServer initialises the Server including the Redis connection.
// If Redis is unavailable the server starts anyway and logs the error —
// it will operate in degraded mode (no presence / pub/sub) until Prompt 3D
// adds retry logic.
func NewServer(cfg *config.Config, logger *utils.Logger) *Server {
	redisClient, err := redis.NewClient(cfg.RedisURL)
	if err != nil {
		logger.Error("Failed to connect to Redis — running in degraded mode", map[string]interface{}{
			"error": err.Error(),
		})
		// redisClient is nil; all redis.Client method calls are guarded with nil checks below
	}

	s := &Server{
		config: cfg,
		logger: logger,
		redis:  redisClient,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// Allow all origins in development; tighten in production via env
			CheckOrigin: func(r *http.Request) bool { return true },
		},
		connections: make(map[string]*Connection),
		register:    make(chan *Connection, 64),
		unregister:  make(chan *Connection, 64),
	}

	// Start the hub loop in the background
	go s.Run()

	return s
}

// HandleConnection is the HTTP handler for the /ws endpoint.
// It validates the JWT from the "token" query param, upgrades to WebSocket,
// and starts read/write pump goroutines for the new connection.
func (s *Server) HandleConnection(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		s.sendAuthError(w, utils.ErrInvalidToken, "Missing token in query parameter.")
		return
	}

	userID, err := s.validateToken(token)
	if err != nil {
		s.logger.Warn("JWT validation failed", map[string]interface{}{
			"error": err.Error(),
		})
		s.sendAuthError(w, utils.ErrInvalidToken, "Invalid or expired token.")
		return
	}

	socket, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("WebSocket upgrade failed", map[string]interface{}{"error": err.Error()})
		return
	}

	conn := &Connection{
		ID:       generateSocketID(),
		UserID:   userID,
		Socket:   socket,
		Send:     make(chan []byte, 256),
		Done:     make(chan struct{}),
		Server:   s,
		Rooms:    make(map[string]bool),
		LastPing: time.Now(),
	}

	s.register <- conn

	// Both goroutines own the socket: writePump closes it, readPump triggers unregister
	go conn.writePump()
	conn.readPump() // block this HTTP goroutine until the connection closes
}

// Run is the hub event loop — serialises connection registration and
// unregistration to avoid data races on s.connections.
func (s *Server) Run() {
	// Fan out presence updates (user_online / user_offline) to all connections
	if s.redis != nil {
		go s.listenPresenceBroadcast()
	}

	for {
		select {
		case conn := <-s.register:
			s.mu.Lock()
			// Displace any existing connection for this user (single-session model).
			// Close() shuts Done first (stops all room goroutines) then Send
			// (signals writePump). sync.Once inside makes this idempotent.
			if old, ok := s.connections[conn.UserID]; ok {
				s.logger.Warn("Displacing existing connection", map[string]interface{}{
					"userId": conn.UserID,
				})
				old.Close() // safe: closes Done then Send via sync.Once
			}
			s.connections[conn.UserID] = conn
			s.mu.Unlock()

			if s.redis != nil {
				ttl := s.config.HeartbeatInterval * 3 // generous TTL
				if err := s.redis.SetUserOnline(conn.UserID, ttl); err != nil {
					s.logger.Error("Redis SetUserOnline failed", map[string]interface{}{
						"userId": conn.UserID, "error": err.Error(),
					})
				}
			}

			s.logger.Info("User connected", map[string]interface{}{
				"userId":   conn.UserID,
				"socketId": conn.ID,
			})

		case conn := <-s.unregister:
			s.mu.Lock()
			// Only remove if this is still the current connection for the user
			// (a new connection may have already replaced it).
			if current, ok := s.connections[conn.UserID]; ok && current.ID == conn.ID {
				delete(s.connections, conn.UserID)
				// Close() is idempotent — safe even if displacement already called it.
				// Closes Done before Send to prevent send-on-closed-channel panics.
				conn.Close()
			}
			s.mu.Unlock()

			s.logger.Info("User disconnected", map[string]interface{}{
				"userId":   conn.UserID,
				"socketId": conn.ID,
			})

			// Broadcast offline presence to all rooms this user was in
			for _, roomID := range conn.GetRooms() {
				s.broadcastToRoom(roomID, protocol.Event{
					Event: "user_offline",
					Payload: mustJSON(map[string]interface{}{
						"user_id":   conn.UserID,
						"status":    "offline",
						"last_seen": time.Now().UTC().Format(time.RFC3339),
					}),
				})
			}

			// Honour the configurable grace period before marking offline
			go s.handleDisconnect(conn.UserID)
		}
	}
}

// handleDisconnect waits for the grace period and then marks the user offline
// in Redis if they have not reconnected by the time the timer fires.
func (s *Server) handleDisconnect(userID string) {
	time.Sleep(s.config.PresenceGracePeriod)

	s.mu.RLock()
	_, stillConnected := s.connections[userID]
	s.mu.RUnlock()

	if !stillConnected && s.redis != nil {
		if err := s.redis.SetUserOffline(userID); err != nil {
			s.logger.Error("Redis SetUserOffline failed", map[string]interface{}{
				"userId": userID, "error": err.Error(),
			})
		}
	}
}

// listenPresenceBroadcast subscribes to the Redis presence:broadcast channel and
// forwards user_online / user_offline events to every connected client.
// EVENT_PROTOCOL.md §4.4: all Gateway instances consume this channel.
func (s *Server) listenPresenceBroadcast() {
	pubsub := s.redis.SubscribePresence()
	defer pubsub.Close() //nolint:errcheck

	for msg := range pubsub.Channel() {
		// Decode the PresenceUpdate published by redis.SetUserOnline/Offline
		var update map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &update); err != nil {
			s.logger.Debug("Malformed presence broadcast — skipped", map[string]interface{}{
				"error": err.Error(),
			})
			continue
		}

		// Map presence status → correct gateway event name (EVENT_PROTOCOL.md §3.6/3.7)
		status, _ := update["status"].(string)
		var eventName string
		switch status {
		case "online":
			eventName = "user_online"
		case "offline":
			eventName = "user_offline"
		default:
			s.logger.Debug("Unknown presence status — skipped", map[string]interface{}{
				"status": status,
			})
			continue
		}

		frame, _ := json.Marshal(protocol.Event{
			Event:   eventName,
			Payload: json.RawMessage(msg.Payload), // raw PresenceUpdate JSON
		})

		// Snapshot connections under read lock to minimise contention
		s.mu.RLock()
		conns := make([]*Connection, 0, len(s.connections))
		for _, c := range s.connections {
			conns = append(conns, c)
		}
		s.mu.RUnlock()

		// Deliver to every client using safeSend — never panics on closed channels
		for _, c := range conns {
			c.safeSend(frame)
		}
	}

	s.logger.Warn("Presence broadcast listener exited", nil)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// GetConnection returns the active connection for a user, if any.
func (s *Server) GetConnection(userID string) (*Connection, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	conn, ok := s.connections[userID]
	return conn, ok
}

// sendAuthError writes a JSON auth_error payload and the appropriate HTTP status
// before the WebSocket upgrade (pre-upgrade HTTP error path).
func (s *Server) sendAuthError(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"event": "auth_error",
		"payload": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

// getConnectedUsersInRoom returns userIDs of all connections currently 
// in the given room.
func (s *Server) getConnectedUsersInRoom(roomID string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var users []string
	for userID, conn := range s.connections {
		if conn.IsInRoom(roomID) {
			users = append(users, userID)
		}
	}
	return users
}
