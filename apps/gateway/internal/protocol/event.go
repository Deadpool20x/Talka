package protocol

import "encoding/json"

// Event is the wire envelope for all WebSocket messages (EVENT_PROTOCOL.md §1).
// Both client→gateway and gateway→client frames use this shape.
type Event struct {
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

// ---------------------------------------------------------------------------
// Client → Gateway payloads (EVENT_PROTOCOL.md §2)
// ---------------------------------------------------------------------------

type AuthenticatePayload struct {
	Token string `json:"token"`
}

type JoinConversationPayload struct {
	ConversationID string `json:"conversation_id"`
}

type LeaveConversationPayload struct {
	ConversationID string `json:"conversation_id"`
}

// SendMessagePayload matches EVENT_PROTOCOL.md §2.4 exactly.
type SendMessagePayload struct {
	ConversationID string  `json:"conversation_id"`
	Content        string  `json:"content"`
	Type           string  `json:"type"`
	TempID         string  `json:"temp_id"`
	ReplyToID      *string `json:"reply_to_id"`
}

type TypingPayload struct {
	ConversationID string `json:"conversation_id"`
	IsTyping       bool   `json:"is_typing"`
}

// MarkReadPayload matches EVENT_PROTOCOL.md §2.6.
type MarkReadPayload struct {
	ConversationID    string `json:"conversation_id"`
	LastReadMessageID string `json:"last_read_message_id"`
}

// ---------------------------------------------------------------------------
// Gateway → Client payloads (EVENT_PROTOCOL.md §3)
// ---------------------------------------------------------------------------

type PongPayload struct {
	ServerTime string `json:"server_time"`
}

type UserJoinedPayload struct {
	ConversationID string `json:"conversation_id"`
	UserID         string `json:"user_id"`
}

type UserLeftPayload struct {
	ConversationID string `json:"conversation_id"`
	UserID         string `json:"user_id"`
}

// ErrorPayload matches EVENT_PROTOCOL.md §3.10.
type ErrorPayload struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	RetryAfter *int   `json:"retry_after,omitempty"`
}
