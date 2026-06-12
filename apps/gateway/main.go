package main

import (
	"log"
	"net/http"

	"chat-os/gateway/internal/config"
	"chat-os/gateway/internal/utils"
	"chat-os/gateway/internal/ws"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Failed to load config:", err)
	}

	logger := utils.NewLogger(cfg.LogLevel)
	logger.Info("Gateway starting", map[string]interface{}{
		"port": cfg.Port,
		"env":  cfg.Env,
	})

	server := ws.NewServer(cfg, logger)

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","service":"chat-os-gateway"}`)) //nolint:errcheck
	})

	http.HandleFunc("/ws", server.HandleConnection)

	addr := ":" + cfg.Port
	logger.Info("Gateway listening", map[string]interface{}{"addr": addr})

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("Gateway failed:", err)
	}
}
