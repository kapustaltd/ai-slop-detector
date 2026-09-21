package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
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
	InputTokens  int     `json:"input_tokens"`
	OutputTokens int     `json:"output_tokens"`
	CostUSD      float64 `json:"cost_usd"`
}

type Response struct {
	Raw   []byte
	Usage Usage
}

type Provider interface {
	Evaluate(context.Context, Request) (Response, error)
}

// OpenAIAdapter keeps provider credentials in the runner process. The model
// receives only the bounded request prompt and never inherits the API key.
type OpenAIAdapter struct {
	Client interface {
		Complete(context.Context, string, string) (string, error)
	}
	SystemPrompt string
}

func (p OpenAIAdapter) Evaluate(ctx context.Context, request Request) (Response, error) {
	if p.Client == nil {
		return Response{}, fmt.Errorf("openai client is required")
	}
	raw, err := p.Client.Complete(ctx, p.SystemPrompt, request.Prompt)
	if err != nil {
		return Response{}, err
	}
	return Response{Raw: []byte(raw), Usage: DecodeUsage([]byte(raw))}, nil
}

// CommandProvider invokes a headless CLI without a shell. Only explicitly
// supplied environment variables plus PATH are passed to the child process.
// In particular, platform credentials from the parent process are not
// inherited by the skill.
type CommandProvider struct {
	Binary  string
	Args    []string
	Env     map[string]string
	Timeout time.Duration
}

func (p CommandProvider) Evaluate(parent context.Context, request Request) (Response, error) {
	if strings.TrimSpace(p.Binary) == "" {
		return Response{}, fmt.Errorf("provider binary is required")
	}
	timeout := p.Timeout
	if timeout <= 0 {
		timeout = 20 * time.Minute
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	args := append([]string(nil), p.Args...)
	if len(args) == 0 {
		args = []string{"-p", request.Prompt}
	}
	cmd := exec.CommandContext(ctx, p.Binary, args...)
	cmd.Dir = request.RepoPath
	cmd.Env = safeEnv(p.Env)
	raw, err := cmd.Output()
	if err != nil {
		if ctx.Err() != nil {
			return Response{}, fmt.Errorf("provider timeout: %w", ctx.Err())
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			return Response{}, fmt.Errorf("provider exited unsuccessfully: %s", sanitize(string(exitErr.Stderr)))
		}
		return Response{}, fmt.Errorf("run provider: %w", err)
	}
	if len(raw) == 0 {
		return Response{}, fmt.Errorf("provider returned an empty response")
	}
	return Response{Raw: raw}, nil
}

// JSONProvider is useful for local integration tests and for operators who
// want to feed precomputed responses through the same ingestion path.
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

func safeEnv(values map[string]string) []string {
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/bin:/bin"
	}
	env := []string{"PATH=" + path, "HOME=/nonexistent", "LANG=C.UTF-8"}
	for key, value := range values {
		if key == "PATH" || key == "HOME" || key == "PWD" || key == "OLDPWD" || strings.Contains(strings.ToLower(key), "key") || strings.Contains(strings.ToLower(key), "token") || strings.Contains(strings.ToLower(key), "secret") || strings.Contains(strings.ToLower(key), "password") {
			continue
		}
		env = append(env, key+"="+value)
	}
	return env
}

func sanitize(value string) string {
	if len(value) > 512 {
		value = value[:512]
	}
	return strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' || r >= 0x20 {
			return r
		}
		return ' '
	}, value)
}

func DecodeUsage(raw []byte) Usage {
	var envelope struct {
		Usage Usage   `json:"usage"`
		Cost  float64 `json:"cost_usd"`
	}
	if json.Unmarshal(raw, &envelope) == nil {
		if envelope.Usage.CostUSD == 0 {
			envelope.Usage.CostUSD = envelope.Cost
		}
		return envelope.Usage
	}
	return Usage{}
}
