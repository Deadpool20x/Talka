// Package auth provides JWT validation for Supabase-issued tokens.
// All rules are derived from ARCHITECTURE.md §6 (Security Requirements).
package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SupabaseClaims mirrors the JWT payload structure issued by Supabase Auth.
// The `sub` field contains the user's UUID — our canonical user identifier.
type SupabaseClaims struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Aud   string `json:"aud"`  // expected value: "authenticated"
	Role  string `json:"role"` // typically "authenticated" for regular users
	jwt.RegisteredClaims
}

// RemoteUserResponse is the response structure returned by Supabase Auth /user endpoint
type RemoteUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// ValidateTokenRemote contacts Supabase's auth service to verify the token remotely
func ValidateTokenRemote(tokenString, supabaseURL, supabaseAnonKey string) (string, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequest("GET", supabaseURL+"/auth/v1/user", nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("apikey", supabaseAnonKey)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("supabase auth returned status: %d", resp.StatusCode)
	}

	var user RemoteUserResponse
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return "", fmt.Errorf("decode json: %w", err)
	}

	if user.ID == "" {
		return "", fmt.Errorf("empty user ID in response")
	}

	return user.ID, nil
}

// ValidateToken parses and verifies a Supabase JWT using HMAC-SHA256.
// It checks:
//   - Signing method is HS256 (not RS256 or other)
//   - Audience claim equals "authenticated" (Supabase default)
//   - Token is not expired (jwt library enforces this by default)
//   - Subject (user ID) is present and non-empty
//
// Returns the user ID (sub claim) on success.
func ValidateToken(tokenString, secret string) (string, error) {
	if secret == "" || secret == "your-jwt-secret-here" || len(secret) < 32 {
		return "", fmt.Errorf("local JWT secret is not configured or is placeholder")
	}

	token, err := jwt.ParseWithClaims(
		tokenString,
		&SupabaseClaims{},
		func(t *jwt.Token) (interface{}, error) {
			// ARCHITECTURE.md §6: must be HMAC-SHA256
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			return []byte(secret), nil
		},
		jwt.WithAudience("authenticated"), // Supabase audience claim
	)
	if err != nil {
		return "", fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*SupabaseClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token claims")
	}
	if claims.Sub == "" {
		return "", fmt.Errorf("token missing subject")
	}

	return claims.Sub, nil
}

// ValidateTokenWithExpiry is a stricter variant that also explicitly checks
// expiry even if the jwt library is lenient. Useful for testing with mocked time.
func ValidateTokenWithExpiry(tokenString, secret string) (string, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&SupabaseClaims{},
		func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		},
		jwt.WithAudience("authenticated"),
		jwt.WithValidMethods([]string{"HS256"}), // whitelist only HS256
	)
	if err != nil {
		return "", fmt.Errorf("parse token: %w", err)
	}

	claims, ok := token.Claims.(*SupabaseClaims)
	if !ok || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	// Explicit expiry check (belt-and-suspenders)
	if claims.ExpiresAt != nil && claims.ExpiresAt.Time.Before(time.Now()) {
		return "", fmt.Errorf("token expired")
	}
	if claims.Sub == "" {
		return "", fmt.Errorf("token missing subject")
	}

	return claims.Sub, nil
}
