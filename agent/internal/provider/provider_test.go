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

// Вызов скилла: рабочий каталог — проект платформы (иначе скиллы не найдутся),
// копия репозитория команды открывается через --add-dir, права — только на чтение.
func TestCommandProviderArgumentsInvokeSkillReadOnly(t *testing.T) {
	p := CommandProvider{Binary: "claude", ProjectDir: "/platform"}
	args := p.arguments(Request{Prompt: "инструкция", RepoPath: "/tmp/teams-repos/snapshot-1"})

	joined := strings.Join(args, " ")
	for _, expected := range []string{
		"-p инструкция", "--output-format json", "--add-dir /tmp/teams-repos/snapshot-1",
		"--allowed-tools Read Glob Grep", "--disallowed-tools Write Edit Bash",
	} {
		if !strings.Contains(joined, expected) {
			t.Errorf("аргументы не содержат %q: %v", expected, args)
		}
	}
}

func TestUnwrapEnvelopeTakesReportAndCost(t *testing.T) {
	envelope := []byte(`{"type":"result","result":"{\"meta\":{}}","total_cost_usd":0.42,"usage":{"input_tokens":11,"output_tokens":22}}`)

	report, usage := unwrapEnvelope(envelope)
	if string(report) != `{"meta":{}}` {
		t.Fatalf("отчёт не извлечён из обёртки: %s", report)
	}
	if usage.CostUSD != 0.42 || usage.InputTokens != 11 || usage.OutputTokens != 22 {
		t.Fatalf("расход не прочитан: %+v", usage)
	}
}

func TestUnwrapEnvelopeAcceptsBareReport(t *testing.T) {
	bare := []byte(`{"meta":{"team_id":"team-1"}}`)

	report, _ := unwrapEnvelope(bare)
	if string(report) != string(bare) {
		t.Fatalf("отчёт без обёртки должен проходить как есть: %s", report)
	}
}
