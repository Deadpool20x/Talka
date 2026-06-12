package ws

import (
	"encoding/json"
	"time"

	"chat-os/gateway/internal/protocol"
	"chat-os/gateway/internal/utils"
)

// handleEvent is the central dispatch router for all inbound WebSocket events.
// Event names are defined in EVENT_PROTOCOL.md §5 (Master Registry).
// Unknown events are silently logged at debug level per §1 protocol rules.
func (s *Server) handleEvent(conn *Connection, msg protocol.Event) {
	switch msg.Event {
	case "authenticate":
		s.handleAuthenticate(conn, msg.Payload)
	case "join_conversation":
		s.handleJoinConversation(conn, msg.Payload)
	case "leave_conversation":
		s.handleLeaveConversation(conn, msg.Payload)
	case "send_message":
		s.handleSendMessage(conn, msg.Payload)
	case "typing":
		s.handleTyping(conn, msg.Payload)
	case "mark_read":
		s.handleMarkRead(conn, msg.Payload)
	case "heartbeat":
		s.handleHeartbeat(conn)
	default:
		// EVENT_PROTOCOL.md §1: unknown events must be silently ignored (log debug only)
		s.logger.Debug("Unknown event — ignored", map[string]interface{}{
			"event":  msg.Event,
			"userId": conn.UserID,
		})
	}
}

// ---------------------------------------------------------------------------
// authenticate (EVENT_PROTOCOL.md §2.1)
// ---------------------------------------------------------------------------

// handleAuthenticate handles the post-open authenticate event.
// JWT is already validated during the HTTP upgrade in HandleConnection;
// this handler handles the in-message variant (clients that omit the query param).
func (s *Server) handleAuthenticate(conn *Connection, payload json.RawMessage) {
	var p protocol.AuthenticatePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid authenticate payload")
		return
	}
	// Re-validate the token from the payload if provided
	if p.Token != "" {
		if _, err := s.validateToken(p.Token); err != nil {
			s.sendError(conn, utils.ErrInvalidToken, "Invalid or expired token")
			return
		}
	}
	s.logger.Debug("Authenticate received", map[string]interface{}{"userId": conn.UserID})

	// Respond with auth_success
	authSuccess, _ := json.Marshal(protocol.Event{
		Event:   "auth_success",
		Payload: json.RawMessage(`{}`),
	})
	// Respond with auth_success — use safeSend to avoid panic on displaced connections
	conn.safeSend(authSuccess)
}

// ---------------------------------------------------------------------------
// join_conversation (EVENT_PROTOCOL.md §2.2)
// ---------------------------------------------------------------------------

func (s *Server) handleJoinConversation(conn *Connection, payload json.RawMessage) {
	var p protocol.JoinConversationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid join_conversation payload")
		return
	}
	if err := protocol.ValidateUUID(p.ConversationID); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, err.Error())
		return
	}

	conn.JoinRoom(p.ConversationID)

	// Subscribe this connection to the Redis Pub/Sub room channel
	if s.redis != nil {
		go s.subscribeToRoom(conn, p.ConversationID)
	}

	// Broadcast user_joined to all room participants (EVENT_PROTOCOL.md §3.7)
	s.broadcastToRoom(p.ConversationID, protocol.Event{
		Event: "user_joined",
		Payload: mustJSON(protocol.UserJoinedPayload{
			ConversationID: p.ConversationID,
			UserID:         conn.UserID,
		}),
	})

	// Send presence of all currently connected users in this room to the joining user
	if s.redis != nil {
		connectedUsers := s.getConnectedUsersInRoom(p.ConversationID)
		for _, onlineUserID := range connectedUsers {
			if onlineUserID == conn.UserID {
				continue // skip self
			}
			presenceEvent, _ := json.Marshal(protocol.Event{
				Event: "user_online",
				Payload: mustJSON(map[string]interface{}{
					"user_id":   onlineUserID,
					"status":    "online",
					"last_seen": time.Now().UTC().Format(time.RFC3339),
				}),
			})
			conn.safeSend(presenceEvent)
		}
	}

	// Also broadcast this user's online presence to everyone else in the room
	if s.redis != nil {
		s.broadcastToRoom(p.ConversationID, protocol.Event{
			Event: "user_online",
			Payload: mustJSON(map[string]interface{}{
				"user_id":   conn.UserID,
				"status":    "online",
				"last_seen": time.Now().UTC().Format(time.RFC3339),
			}),
		})
	}

	s.logger.Debug("User joined room", map[string]interface{}{
		"userId": conn.UserID,
		"roomId": p.ConversationID,
	})
}

// ---------------------------------------------------------------------------
// leave_conversation (EVENT_PROTOCOL.md §2.3)
// ---------------------------------------------------------------------------

func (s *Server) handleLeaveConversation(conn *Connection, payload json.RawMessage) {
	var p protocol.LeaveConversationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid leave_conversation payload")
		return
	}

	conn.LeaveRoom(p.ConversationID)

	// Broadcast user_left to remaining room participants (EVENT_PROTOCOL.md §3.8)
	s.broadcastToRoom(p.ConversationID, protocol.Event{
		Event: "user_left",
		Payload: mustJSON(protocol.UserLeftPayload{
			ConversationID: p.ConversationID,
			UserID:         conn.UserID,
		}),
	})

	s.logger.Debug("User left room", map[string]interface{}{
		"userId": conn.UserID,
		"roomId": p.ConversationID,
	})
}

// ---------------------------------------------------------------------------
// send_message (EVENT_PROTOCOL.md §2.4)
// Messages are queued to stream:messages:incoming — NOT published directly
// to the room. The API worker persists and then publishes via Pub/Sub.
// ---------------------------------------------------------------------------

func (s *Server) handleSendMessage(conn *Connection, payload json.RawMessage) {
	var p protocol.SendMessagePayload
	if err := json.Unmarshal(payload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid send_message payload")
		return
	}

	if err := protocol.ValidateUUID(p.ConversationID); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid conversation_id: "+err.Error())
		return
	}
	if err := protocol.ValidateMessageType(p.Type); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, err.Error())
		return
	}
	if err := protocol.ValidateContent(p.Content); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, err.Error())
		return
	}
	if err := protocol.ValidateUUID(p.TempID); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid temp_id: "+err.Error())
		return
	}

	if s.redis != nil {
		// JSON marshal the entire payload as expected by API worker
		payloadMap := map[string]interface{}{
			"event":           "send_message",
			"sender_id":       conn.UserID,
			"conversation_id": p.ConversationID,
			"content":         p.Content,
			"type":            p.Type,
			"temp_id":         p.TempID,
			"sent_at":         time.Now().UTC().Format(time.RFC3339),
		}
		if p.ReplyToID != nil {
			payloadMap["reply_to_id"] = *p.ReplyToID
		}

		payloadJSON, _ := json.Marshal(payloadMap)

		values := map[string]interface{}{
			"event": "send_message",
			"data":  string(payloadJSON),
		}

		if err := s.redis.AddToStream("stream:messages:incoming", values); err != nil {
			s.logger.Error("Failed to add message to stream", map[string]interface{}{
				"error": err.Error(),
			})
			s.sendError(conn, utils.ErrInternalError, "Failed to queue message. Please retry.")
			return
		}
	}

	s.logger.Debug("Message queued to stream", map[string]interface{}{
		"userId":         conn.UserID,
		"conversationId": p.ConversationID,
		"tempId":         p.TempID,
	})
}

// ---------------------------------------------------------------------------
// typing (EVENT_PROTOCOL.md §2.5)
// Typing indicators are ephemeral — published directly to Redis Pub/Sub,
// NOT written to the stream (no persistence required).
// ---------------------------------------------------------------------------

func (s *Server) handleTyping(conn *Connection, rawPayload json.RawMessage) {
	var p protocol.TypingPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid typing payload")
		return
	}
	if err := protocol.ValidateUUID(p.ConversationID); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, err.Error())
		return
	}

	if s.redis != nil {
		// Build outbound typing event for all room subscribers
		outbound, _ := json.Marshal(map[string]interface{}{
			"event": "typing",
			"payload": map[string]interface{}{
				"conversation_id": p.ConversationID,
				"user_id":         conn.UserID,
				"is_typing":       p.IsTyping,
			},
		})
		// Direct Pub/Sub — no stream, no persistence (EVENT_PROTOCOL.md §5 legend)
		if err := s.redis.PublishToRoom(p.ConversationID, outbound); err != nil {
			s.logger.Error("Failed to publish typing indicator", map[string]interface{}{
				"error": err.Error(),
			})
		}
	}
}

// ---------------------------------------------------------------------------
// mark_read (EVENT_PROTOCOL.md §2.6)
// Must go to the stream so the API worker can persist the read receipt.
// ---------------------------------------------------------------------------

func (s *Server) handleMarkRead(conn *Connection, payload json.RawMessage) {
	var p protocol.MarkReadPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, "Invalid mark_read payload")
		return
	}
	if err := protocol.ValidateUUID(p.ConversationID); err != nil {
		s.sendError(conn, utils.ErrInvalidPayload, err.Error())
		return
	}

	if s.redis != nil {
		// JSON marshal the entire payload as expected by API worker
		payloadMap := map[string]interface{}{
			"event":                "mark_read",
			"sender_id":            conn.UserID, // consistent with API worker's schema
			"conversation_id":      p.ConversationID,
			"last_read_message_id": p.LastReadMessageID,
			"sent_at":              time.Now().UTC().Format(time.RFC3339),
		}

		payloadJSON, _ := json.Marshal(payloadMap)

		values := map[string]interface{}{
			"event": "mark_read",
			"data":  string(payloadJSON),
		}

		if err := s.redis.AddToStream("stream:messages:incoming", values); err != nil {
			s.logger.Error("Failed to queue mark_read to stream", map[string]interface{}{
				"error": err.Error(),
			})
		}
	}
}

// ---------------------------------------------------------------------------
// heartbeat (EVENT_PROTOCOL.md §2.7)
// Gateway responds with pong and refreshes the Redis heartbeat TTL.
// ---------------------------------------------------------------------------

func (s *Server) handleHeartbeat(conn *Connection) {
	conn.LastPing = time.Now()

	if s.redis != nil {
		// Refresh heartbeat TTL (EVENT_PROTOCOL.md §6.3: 1 per 30s per connection)
		_ = s.redis.SetUserHeartbeat(conn.UserID, s.config.HeartbeatInterval*3)
	}

	pong, _ := json.Marshal(protocol.Event{
		Event:   "pong",
		Payload: mustJSON(protocol.PongPayload{ServerTime: time.Now().UTC().Format(time.RFC3339)}),
	})
	// safeSend: non-blocking, recovers from closed channel (conn may be displaced)
	if !conn.safeSend(pong) {
		s.logger.Warn("Pong dropped — connection closed or send buffer full", map[string]interface{}{
			"userId": conn.UserID,
		})
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// sendError enqueues a gateway error event to the connection's send buffer.
func (s *Server) sendError(conn *Connection, code, message string) {
	frame, _ := json.Marshal(protocol.Event{
		Event:   "error",
		Payload: mustJSON(protocol.ErrorPayload{Code: code, Message: message}),
	})
	// safeSend: silently drops if connection is closed or buffer is full
	conn.safeSend(frame)
}

// broadcastToRoom publishes an event to the Redis room channel so ALL Gateway
// instances subscribed to the room deliver it to their local connections.
func (s *Server) broadcastToRoom(roomID string, event protocol.Event) {
	if s.redis == nil {
		return
	}
	frame, _ := json.Marshal(event)
	if err := s.redis.PublishToRoom(roomID, frame); err != nil {
		s.logger.Error("broadcastToRoom failed", map[string]interface{}{
			"roomId": roomID, "error": err.Error(),
		})
	}
}

// mustJSON marshals v to JSON. Panics are impossible for well-typed protocol
// structs — the `_` error is intentional and documented here.
func mustJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return json.RawMessage(b)
}
