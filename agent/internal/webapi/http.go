package webapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

func NewHandler(manager *Manager, token string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthHandler)
	mux.HandleFunc("/api/v1/runs", runsHandler(manager, token))
	mux.HandleFunc("/api/v1/runs/", runHandler(manager, token))
	return mux
}

func healthHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", nil)
		return
	}
	writeJSON(writer, http.StatusOK, map[string]any{"data": map[string]string{"status": "ok"}})
}

func runsHandler(manager *Manager, token string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", nil)
			return
		}
		if !authorized(request, token) {
			writeError(writer, http.StatusUnauthorized, "unauthorized", "authorization required", nil)
			return
		}
		var input Request
		decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 16*1024))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil {
			writeError(writer, http.StatusBadRequest, "invalid_json", "request body must be valid JSON", nil)
			return
		}
		job, err := manager.Create(request.Context(), input)
		if err != nil {
			var fieldErr fieldValidationError
			switch {
			case errors.As(err, &fieldErr):
				writeError(writer, http.StatusBadRequest, "validation_error", "request validation failed", []fieldValidationError{fieldErr})
			case errors.Is(err, ErrBusy):
				writer.Header().Set("Retry-After", "30")
				writeError(writer, http.StatusTooManyRequests, "rate_limit_exceeded", "another run is already active", nil)
			default:
				writeError(writer, http.StatusInternalServerError, "internal_error", "could not create run", nil)
			}
			return
		}
		location := "/api/v1/runs/" + job.ID
		writer.Header().Set("Location", location)
		writeJSON(writer, http.StatusAccepted, map[string]any{"data": job})
	}
}

func runHandler(manager *Manager, token string) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writeError(writer, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", nil)
			return
		}
		if !authorized(request, token) {
			writeError(writer, http.StatusUnauthorized, "unauthorized", "authorization required", nil)
			return
		}
		id := strings.TrimPrefix(request.URL.Path, "/api/v1/runs/")
		if id == "" || strings.Contains(id, "/") {
			writeError(writer, http.StatusNotFound, "not_found", "run not found", nil)
			return
		}
		job, err := manager.Get(id)
		if errors.Is(err, ErrNotFound) {
			writeError(writer, http.StatusNotFound, "not_found", "run not found", nil)
			return
		}
		if err != nil {
			writeError(writer, http.StatusInternalServerError, "internal_error", "could not load run", nil)
			return
		}
		writeJSON(writer, http.StatusOK, map[string]any{"data": job})
	}
}

func authorized(request *http.Request, token string) bool {
	if token == "" {
		return true
	}
	value := request.Header.Get("Authorization")
	return strings.HasPrefix(value, "Bearer ") && strings.TrimSpace(strings.TrimPrefix(value, "Bearer ")) == token
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, status int, code, message string, details any) {
	value := map[string]any{"code": code, "message": message}
	if details != nil {
		value["details"] = details
	}
	writeJSON(writer, status, map[string]any{"error": value})
}

func ErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%s", err)
}
