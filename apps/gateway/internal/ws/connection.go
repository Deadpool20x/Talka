package ws

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"chat-os/gateway/internal/protocol"
)

// Connection represents a single authenticated WebSocket client.
type Connection struct {
	ID       string          // unique socket identifier (hex random)
	UserID   string          // authenticated Supabase user ID (JWT sub)
	Socket   *websocket.Conn // underlying gorilla WebSocket connection
	Send     chan []byte      // outbound message queue (buffered)
	Done     chan struct{}    // closed when this connection terminates
	Server   *Server         // back-reference for register/unregister
	Rooms    map[string]bool // conversation IDs this socket has joined
	mu       sync.RWMutex   // guards Rooms map
	closeOnce sync.Once      // ensures Send and Done are closed exactly once
	LastPing time.Time      // last pong received from client
}

// Close tears down the connection channels exactly once (idempotent).
// Done is closed first so all goroutines that select on Done can exit
// cleanly before Send is closed, eliminating the "send on closed channel"
// race condition.
func (c *Connection) Close() {
	c.closeOnce.Do(func() {
		close(c.Done) // 1. signal all goroutines that reference Done
		close(c.Send) // 2. signal writePump to send WebSocket close frame
	})
}

// safeSend attempts to enqueue b on the Send channel.
// Returns false (silently) if the connection is already closed or the
// buffer is full. Uses recover() as a last-resort guard for the rare window
// where Done is already closed but Send is not yet drained.
func (c *Connection) safeSend(b []byte) bool {
	// Fast-path: check Done first to avoid sending on a closing channel.
	select {
	case <-c.Done:
		return false
	default:
	}

	// Non-blocking send with panic recovery as an ultimate safety net.
	// The recover handles the narrow race between the Done check above
	// and the channel being closed by another goroutine.
	defer func() { recover() }() //nolint:errcheck
	select {
	case c.Send <- b:
		return true
	case <-c.Done:
		return false
	default:
		return false // buffer full — caller decides whether to log
	}
}

// readPump reads JSON frames from the WebSocket and dispatches to handleEvent.
// Runs in its own goroutine per connection.
func (c *Connection) readPump() {
	defer func() {
		c.Server.unregister <- c
		c.Socket.Close()
	}()

	c.Socket.SetReadLimit(512 * 1024) // 512 KB max frame (EVENT_PROTOCOL.md §6.2)
	c.Socket.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Socket.SetPongHandler(func(string) error {
		c.Socket.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.LastPing = time.Now()
		return nil
	})

	for {
		var msg protocol.Event
		err := c.Socket.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				c.Server.logger.Error("WebSocket read error", map[string]interface{}{
					"userId": c.UserID,
					"error":  err.Error(),
				})
			}
			break
		}
		c.Server.handleEvent(c, msg)
	}
}

// writePump drains the Send channel to the WebSocket and sends periodic pings.
// Runs in its own goroutine per connection.
func (c *Connection) writePump() {
	ticker := time.NewTicker(c.Server.config.HeartbeatInterval)
	defer func() {
		ticker.Stop()
		c.Socket.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Socket.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Socket.WriteMessage(websocket.CloseMessage, []byte{}) //nolint:errcheck
				return
			}
			if err := c.Socket.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Socket.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Socket.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Room membership — mutex-protected (EVENT_PROTOCOL.md §2.2/2.3)
// ---------------------------------------------------------------------------

func (c *Connection) JoinRoom(roomID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.Rooms[roomID] = true
}

func (c *Connection) LeaveRoom(roomID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.Rooms, roomID)
}

func (c *Connection) IsInRoom(roomID string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.Rooms[roomID]
}

func (c *Connection) GetRooms() []string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	var rooms []string
	for roomID := range c.Rooms {
		rooms = append(rooms, roomID)
	}
	return rooms
}

// SendJSON serialises v and queues it on the Send channel.
// Returns false if the connection is closed or the buffer is full (message dropped).
func (c *Connection) SendJSON(v interface{}) bool {
	b, err := json.Marshal(v)
	if err != nil {
		return false
	}
	return c.safeSend(b)
}
