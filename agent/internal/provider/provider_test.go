package provider

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCommandProviderDoesNotInheritSecrets(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "provider")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nif [ -n \"$PLATFORM_SECRET\" ] || [ -n \"$API_TOKEN\" ]; then exit 7; fi\nprintf '{}'"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PLATFORM_SECRET", "must-not-pass")
	t.Setenv("API_TOKEN", "must-not-pass")
	result, err := (CommandProvider{Binary: script, Env: map[string]string{"PLATFORM_SECRET": "also-hidden", "SAFE_FLAG": "ok"}}).Evaluate(context.Background(), Request{RepoPath: dir, Prompt: "data"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(result.Raw)) != "{}" {
		t.Fatalf("unexpected output: %q", result.Raw)
	}
}

func TestJSONProviderCopiesResponses(t *testing.T) {
	provider := &JSONProvider{Responses: [][]byte{[]byte(`{"ok":true}`)}}
	first, err := provider.Evaluate(context.Background(), Request{})
	if err != nil {
		t.Fatal(err)
	}
	first.Raw[0] = 'x'
	if string(provider.Responses[0]) != `{"ok":true}` {
		t.Fatal("provider response was not copied")
	}
}
