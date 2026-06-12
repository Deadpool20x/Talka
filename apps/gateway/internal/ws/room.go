package ws

import (
	"encoding/json"

	"chat-os/gateway/internal/protocol"
)

// subscribeToRoom subscribes this connection to the Redis Pub/Sub channel
// room:{roomId} and forwards all received events to the client's Send buffer.
//
// This goroutine exits when:
//   a. The client leaves the room (conn.IsInRoom returns false)
//   b. The Redis subscription channel closes
//   c. conn.Done is closed (connection terminated)
//
// Called in its own goroutine by handleJoinConversation.
func (s *Server) subscribeToRoom(conn *Connection, roomID string) {
	if s.redis == nil {
		return
	}

	pubsub := s.redis.SubscribeToRoom(roomID)
	defer pubsub.Close() //nolint:errcheck

	ch := pubsub.Channel()

	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				// Redis subscription channel closed (Redis restart / network issue)
				return
			}
			// Stop forwarding if the client has left this room
			if !conn.IsInRoom(roomID) {
				return
			}

			var event protocol.Event
			if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
				s.logger.Debug("Malformed Pub/Sub payload — skipped", map[string]interface{}{
					"roomId": roomID, "error": err.Error(),
				})
				continue
			}

			frame, _ := json.Marshal(event)
			// safeSend checks conn.Done and recovers from panics on closed channels.
			// This eliminates the race where the outer select picks the msg branch
			// and the inner send races against a concurrent Close() call.
			if !conn.safeSend(frame) {
				return
			}

		case <-conn.Done:
			// Connection closed — stop the subscription goroutine cleanly
			return
		}
	}
}
