package provider

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestClientComplete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if got := request.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("authorization = %q", got)
		}
		if request.URL.Path != "/chat/completions" {
			t.Fatalf("path = %q", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"choices":[{"message":{"content":"{\"ok\":true}"}}]}`))
	}))
	defer server.Close()

	client, err := New(Config{
		BaseURL:          server.URL,
		APIKey:           "test-key",
		Model:            "gpt-test",
		Effort:           "none",
		Timeout:          time.Second,
		MaxResponseBytes: 1024,
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := client.Complete(context.Background(), "system", "user")
	if err != nil {
		t.Fatal(err)
	}
	if got != `{"ok":true}` {
		t.Fatalf("response = %q", got)
	}
}

func TestClientDoesNotExposeKeyOnHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusUnauthorized)
		_, _ = writer.Write([]byte(`{"error":"invalid api_key sk-secret-value"}`))
	}))
	defer server.Close()

	client, err := New(Config{BaseURL: server.URL, APIKey: "test-key", Model: "gpt-test"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Complete(context.Background(), "system", "user")
	if err == nil {
		t.Fatal("expected HTTP error")
	}
	if strings.Contains(err.Error(), "sk-secret-value") || strings.Contains(err.Error(), "test-key") {
		t.Fatalf("error exposed a secret: %v", err)
	}
}

func TestConfigFromEnvRequiresKey(t *testing.T) {
	t.Setenv("AGENT_API_KEY", "")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("expected missing key error")
	}
}
