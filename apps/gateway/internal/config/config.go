package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the Gateway.
type Config struct {
	Port                string
	RedisURL            string
	JWTSecret           string
	APIServerURL        string
	Env                 string
	LogLevel            string
	HeartbeatInterval   time.Duration
	PresenceGracePeriod time.Duration
	SupabaseURL         string
	SupabaseAnonKey     string
}

// Load reads environment variables (and an optional .env file) into Config.
// Returns an error if any required field is missing.
func Load() (*Config, error) {
	// Best-effort: load .env if present; ignore if missing
	_ = godotenv.Load()

	heartbeat, _ := strconv.Atoi(getEnv("WS_HEARTBEAT_INTERVAL", "30"))
	grace, _ := strconv.Atoi(getEnv("PRESENCE_GRACE_PERIOD", "30"))

	return &Config{
		Port:                getEnv("GATEWAY_PORT", "4000"),
		RedisURL:            getEnv("GATEWAY_REDIS_URL", "redis://localhost:6379"),
		JWTSecret:           getEnv("GATEWAY_JWT_SECRET", ""),
		APIServerURL:        getEnv("GATEWAY_API_URL", "http://localhost:3001/api/v1"),
		Env:                 getEnv("GATEWAY_ENV", "development"),
		LogLevel:            getEnv("GATEWAY_LOG_LEVEL", "info"),
		HeartbeatInterval:   time.Duration(heartbeat) * time.Second,
		PresenceGracePeriod: time.Duration(grace) * time.Second,
		SupabaseURL:         getEnv("SUPABASE_URL", getEnv("NEXT_PUBLIC_SUPABASE_URL", "https://nonnmvyhaahqogoghflc.supabase.co")),
		SupabaseAnonKey:     getEnv("SUPABASE_ANON_KEY", getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")),
	}, nil
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
