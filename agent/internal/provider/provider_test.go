package provider

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCodexProviderDoesNotInheritSecrets(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "provider")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nif [ -n \"$PLATFORM_SECRET\" ] || [ -n \"$API_TOKEN\" ]; then exit 7; fi\nprintf '{}'"), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PLATFORM_SECRET", "must-not-pass")
	t.Setenv("API_TOKEN", "must-not-pass")
	result, err := (CodexProvider{Binary: script, Args: []string{"noop"}, Env: map[string]string{"PLATFORM_SECRET": "also-hidden", "SAFE_FLAG": "ignored"}}).Evaluate(context.Background(), Request{RepoPath: dir, Prompt: "data"})
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

func TestCodexProviderArgumentsAreIsolatedAndStructured(t *testing.T) {
	p := CodexProvider{Binary: "codex", ProjectDir: "/platform", OutputSchema: "/platform/schemas/review-output.schema.json", Model: "gpt-5.6-terra", ReasoningEffort: "medium"}
	args := p.arguments(Request{Prompt: "инструкция", RepoPath: "/tmp/teams-repos/snapshot-1"})

	joined := strings.Join(args, " ")
	for _, expected := range []string{
		"exec --json --ephemeral --ignore-user-config --strict-config", "--sandbox read-only",
		"--cd /platform", "--model gpt-5.6-terra", `model_reasoning_effort="medium"`,
		"--output-schema /platform/schemas/review-output.schema.json", "инструкция",
	} {
		if !strings.Contains(joined, expected) {
			t.Errorf("аргументы не содержат %q: %v", expected, args)
		}
	}
}

func TestDecodeCodexJSONLReadsFinalMessageAndUsage(t *testing.T) {
	raw := []byte("{\"type\":\"thread.started\",\"thread_id\":\"thread-1\"}\n" +
		"{\"type\":\"item.completed\",\"item\":{\"type\":\"agent_message\",\"text\":\"{\\\"metrics\\\":[]}\"}}\n" +
		"{\"type\":\"turn.completed\",\"usage\":{\"input_tokens\":11,\"cached_input_tokens\":7,\"output_tokens\":22}}\n")
	response, err := decodeCodexJSONL(raw)
	if err != nil {
		t.Fatal(err)
	}
	if string(response.Raw) != `{"metrics":[]}` || response.SessionID != "thread-1" {
		t.Fatalf("unexpected response: %+v", response)
	}
	if response.Usage.InputTokens != 11 || response.Usage.CachedInputTokens != 7 || response.Usage.OutputTokens != 22 {
		t.Fatalf("usage was not decoded: %+v", response.Usage)
	}
}
