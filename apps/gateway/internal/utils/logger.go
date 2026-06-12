package utils

import (
	"encoding/json"
	"fmt"
	"time"
)

// Logger is a minimal structured JSON logger.
type Logger struct {
	Level string
}

// NewLogger creates a Logger with the given minimum level.
func NewLogger(level string) *Logger {
	return &Logger{Level: level}
}

func (l *Logger) log(level string, msg string, fields map[string]interface{}) {
	if !l.shouldLog(level) {
		return
	}
	entry := map[string]interface{}{
		"time":    time.Now().UTC().Format(time.RFC3339),
		"level":   level,
		"message": msg,
	}
	for k, v := range fields {
		entry[k] = v
	}
	b, _ := json.Marshal(entry)
	fmt.Println(string(b))
}

func (l *Logger) shouldLog(level string) bool {
	levels := map[string]int{"debug": 0, "info": 1, "warn": 2, "error": 3}
	current, ok := levels[l.Level]
	if !ok {
		current = 1 // default to info
	}
	target, ok := levels[level]
	if !ok {
		return false
	}
	return target >= current
}

func (l *Logger) Debug(msg string, fields map[string]interface{}) { l.log("debug", msg, fields) }
func (l *Logger) Info(msg string, fields map[string]interface{})  { l.log("info", msg, fields) }
func (l *Logger) Warn(msg string, fields map[string]interface{})  { l.log("warn", msg, fields) }
func (l *Logger) Error(msg string, fields map[string]interface{}) { l.log("error", msg, fields) }
