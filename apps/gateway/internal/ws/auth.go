package ws

import "chat-os/gateway/internal/auth"

// validateToken delegates to the dedicated auth package.
// It verifies the JWT signature, audience, expiry, and subject claim.
// See internal/auth/jwt.go for full implementation details.
func (s *Server) validateToken(token string) (string, error) {
	userID, err := auth.ValidateToken(token, s.config.JWTSecret)
	if err == nil {
		return userID, nil
	}

	// Fallback to remote verification via Supabase API
	return auth.ValidateTokenRemote(token, s.config.SupabaseURL, s.config.SupabaseAnonKey)
}
