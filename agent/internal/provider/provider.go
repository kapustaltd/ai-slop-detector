package provider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"
)

type Request struct {
	TeamID        string
	Area          string
	RepoID        string
	RepoPath      string
	CommitSHA     string
	RubricVersion string
	RubricPath    string
	Prompt        string
}

type Usage struct {
	InputTokens       int     `json:"input_tokens"`
	CachedInputTokens int     `json:"cached_input_tokens,omitempty"`
	OutputTokens      int     `json:"output_tokens"`
	CostUSD           float64 `json:"cost_usd"`
}

type Response struct {
	Raw       []byte
	Usage     Usage
	SessionID string
}

type Provider interface {
	Evaluate(context.Context, Request) (Response, error)
}

// CodexProvider запускает изолированный codex exec. Репозиторий команды доступен
// только на чтение, пользовательские MCP/настройки не наследуются, а JSON Schema
// заставляет модель вернуть синтаксически корректный компактный контракт.
type CodexProvider struct {
	Binary          string
	ProjectDir      string
	OutputSchema    string
	Model           string
	ReasoningEffort string
	Args            []string
	Env             map[string]string
	Timeout         time.Duration
}

func (p CodexProvider) arguments(request Request) []string {
	if len(p.Args) > 0 {
		return append([]string(nil), p.Args...)
	}
	args := []string{
		"exec", "--json", "--ephemeral", "--ignore-user-config", "--strict-config",
		"--sandbox", "read-only", "--color", "never",
	}
	if p.ProjectDir != "" {
		args = append(args, "--cd", p.ProjectDir)
	}
	if p.Model != "" {
		args = append(args, "--model", p.Model)
	}
	if p.ReasoningEffort != "" {
		args = append(args, "--config", fmt.Sprintf("model_reasoning_effort=%q", p.ReasoningEffort))
	}
	args = append(args, "--config", "tools.web_search=false")
	if p.OutputSchema != "" {
		args = append(args, "--output-schema", p.OutputSchema)
	}
	return append(args, request.Prompt)
}

func (p CodexProvider) Evaluate(parent context.Context, request Request) (Response, error) {
	if strings.TrimSpace(p.Binary) == "" {
		return Response{}, fmt.Errorf("provider binary is required")
	}
	if len(p.Args) == 0 && strings.TrimSpace(p.OutputSchema) == "" {
		return Response{}, fmt.Errorf("provider output schema is required")
	}
	timeout := p.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Minute
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, p.Binary, p.arguments(request)...)
	cmd.Dir = p.ProjectDir
	cmd.Env = safeEnv(p.Env)
	stdout, err := cmd.Output()
	if err != nil {
		if ctx.Err() != nil {
			return Response{}, fmt.Errorf("provider timeout: %w", ctx.Err())
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr := sanitize(string(exitErr.Stderr))
			output := sanitize(string(stdout))
			if stderr != "" && output != "" {
				return Response{}, fmt.Errorf("provider exited unsuccessfully: %s (stdout: %s)", stderr, output)
			}
			if output != "" {
				return Response{}, fmt.Errorf("provider exited unsuccessfully: %s", output)
			}
			return Response{}, fmt.Errorf("provider exited unsuccessfully: %s", stderr)
		}
		return Response{}, fmt.Errorf("run provider: %w", err)
	}
	if len(bytes.TrimSpace(stdout)) == 0 {
		return Response{}, fmt.Errorf("provider returned an empty response")
	}
	return decodeCodexJSONL(stdout)
}

func decodeCodexJSONL(raw []byte) (Response, error) {
	var response Response
	var sawEvent bool
	scanner := bufio.NewScanner(bytes.NewReader(raw))
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		var event struct {
			Type     string `json:"type"`
			ThreadID string `json:"thread_id"`
			Item     struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"item"`
			Usage Usage `json:"usage"`
		}
		if err := json.Unmarshal(line, &event); err != nil || event.Type == "" {
			if !sawEvent && json.Valid(bytes.TrimSpace(raw)) {
				return Response{Raw: append([]byte(nil), bytes.TrimSpace(raw)...)}, nil
			}
			return Response{}, fmt.Errorf("decode codex JSONL event: %w", err)
		}
		sawEvent = true
		switch event.Type {
		case "thread.started":
			response.SessionID = event.ThreadID
		case "item.completed":
			if event.Item.Type == "agent_message" && strings.TrimSpace(event.Item.Text) != "" {
				response.Raw = []byte(event.Item.Text)
			}
		case "turn.completed":
			response.Usage = event.Usage
		}
	}
	if err := scanner.Err(); err != nil {
		return Response{}, fmt.Errorf("read codex JSONL: %w", err)
	}
	if len(response.Raw) == 0 {
		return Response{}, fmt.Errorf("codex JSONL contains no final agent message")
	}
	return response, nil
}

type JSONProvider struct {
	Responses [][]byte
	Index     int
}

func (p *JSONProvider) Evaluate(context.Context, Request) (Response, error) {
	if p == nil || p.Index >= len(p.Responses) {
		return Response{}, fmt.Errorf("fake provider has no response")
	}
	raw := append([]byte(nil), p.Responses[p.Index]...)
	p.Index++
	return Response{Raw: raw}, nil
}

var allowedEnvironment = map[string]bool{
	"PATH": true, "HOME": true, "CODEX_HOME": true, "LANG": true, "LC_ALL": true,
	"LC_CTYPE": true, "TMPDIR": true, "TERM": true, "USER": true, "LOGNAME": true,
	"SHELL": true, "COLORTERM": true,
}

func safeEnv(values map[string]string) []string {
	merged := map[string]string{}
	for _, kv := range os.Environ() {
		key, value, found := strings.Cut(kv, "=")
		if found && allowedEnvironment[key] {
			merged[key] = value
		}
	}
	for key, value := range values {
		if allowedEnvironment[key] {
			merged[key] = value
		}
	}
	if merged["PATH"] == "" {
		merged["PATH"] = "/usr/bin:/bin"
	}
	if merged["LANG"] == "" {
		merged["LANG"] = "C.UTF-8"
	}
	merged["NO_COLOR"] = "1"
	keys := make([]string, 0, len(merged))
	for key := range merged {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	env := make([]string, 0, len(keys))
	for _, key := range keys {
		env = append(env, key+"="+merged[key])
	}
	return env
}

func sanitize(value string) string {
	if len(value) > 1024 {
		value = value[:1024]
	}
	return strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' || r >= 0x20 {
			return r
		}
		return ' '
	}, value)
}
