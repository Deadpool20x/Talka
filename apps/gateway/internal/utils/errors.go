package utils

// Standardized error codes sent to WebSocket clients.
// These match the error shapes defined in EVENT_PROTOCOL.md §2.
const (
	ErrInvalidToken   = "INVALID_TOKEN"
	ErrInvalidPayload = "INVALID_PAYLOAD"
	ErrRateLimited    = "RATE_LIMITED"
	ErrUnauthorized   = "UNAUTHORIZED"
	ErrInternalError  = "INTERNAL_ERROR"
)
