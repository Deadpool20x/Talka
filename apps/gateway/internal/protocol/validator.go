package protocol

import (
	"fmt"
	"regexp"
)

// uuidRegex implements the UUID v4 pattern defined in EVENT_PROTOCOL.md §6.1.
// Pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
var uuidRegex = regexp.MustCompile(
	`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
)

// ValidateUUID returns an error if s is not a valid UUID v4 (EVENT_PROTOCOL.md §6.1).
func ValidateUUID(s string) error {
	if !uuidRegex.MatchString(s) {
		return fmt.Errorf("invalid UUID format")
	}
	return nil
}

// validMessageTypes are the types a client may send (EVENT_PROTOCOL.md §2.4).
// "system" is reserved for server use only and is intentionally excluded.
var validMessageTypes = map[string]bool{"text": true, "image": true, "file": true}

// ValidateMessageType returns an error if t is not an allowed client message type.
func ValidateMessageType(t string) error {
	if !validMessageTypes[t] {
		return fmt.Errorf("invalid message type: %s", t)
	}
	return nil
}

// ValidateContent enforces EVENT_PROTOCOL.md §6.2 content length rules.
// Applied when type is "text"; image and file types use caption/filename rules
// but share the same upper bound for simplicity.
func ValidateContent(content string) error {
	if len(content) == 0 || len(content) > 4000 {
		return fmt.Errorf("content must be 1-4000 characters")
	}
	return nil
}
