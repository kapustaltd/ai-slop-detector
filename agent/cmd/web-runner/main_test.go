package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
)

func TestConfiguredHTTPProvider(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Method != http.MethodPost {
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing provider authorization")
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"choices":[{"message":{"content":"{\"ok\":true}"}}]}`)
	}))
	defer server.Close()
	t.Setenv("AGENT_API_KEY", "test-key")
	t.Setenv("AGENT_BASE_URL", server.URL+"/v1")
	p, err := configuredProvider("missing-cli")
	if err != nil {
		t.Fatal(err)
	}
	response, err := p.Evaluate(context.Background(), provider.Request{Prompt: "review"})
	if err != nil {
		t.Fatal(err)
	}
	if string(response.Raw) != `{"ok":true}` {
		t.Fatalf("unexpected response: %s", response.Raw)
	}
}

func TestConfiguredCLIProvider(t *testing.T) {
	t.Setenv("AGENT_API_KEY", "")
	p, err := configuredProvider("custom-cli")
	if err != nil {
		t.Fatal(err)
	}
	command, ok := p.(provider.CommandProvider)
	if !ok || command.Binary != "custom-cli" {
		t.Fatal("CLI fallback was not preserved")
	}
}

func TestConfiguredProviderRejectsInvalidConfig(t *testing.T) {
	t.Setenv("AGENT_API_KEY", "test-key")
	t.Setenv("AGENT_TIMEOUT_SECONDS", "invalid")
	if _, err := configuredProvider("missing-cli"); err == nil {
		t.Fatal("invalid HTTP configuration accepted")
	}
}
