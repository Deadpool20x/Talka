package ws

import (
	"crypto/rand"
	"encoding/hex"
)

// generateSocketID generates a 16-byte cryptographically random socket identifier.
// Used as Connection.ID — distinct from UserID so one user can have multiple sockets
// if the single-session constraint is relaxed in future.
func generateSocketID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Should never happen; fall back to a detectable sentinel
		return "socket-rng-failure"
	}
	return hex.EncodeToString(b)
}
