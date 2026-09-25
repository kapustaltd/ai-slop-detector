package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	OnActivity    func(Activity)
	Categories    map[string]string
	OnUsage       func(Usage)
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

// CommandProvider вызывает скилл ревью headless-командой, без shell.
//
// Задачу оценки формулирует скилл (спека 002); сюда приходит только короткая
// инструкция с координатами прогона. Рабочим каталогом служит корень проекта
// платформы — иначе Claude Code не найдёт скиллы в `.claude/skills`. Копия
// репозитория команды открывается отдельно, через --add-dir, и остаётся данными.
//
// Дочернему процессу передаются только явно указанные переменные окружения плюс
// PATH: секреты платформы не наследуются (спека 003 FR-013d).
type CommandProvider struct {
	Binary string
	// ProjectDir — корень проекта платформы, откуда обнаруживаются скиллы.
	ProjectDir string
	// Args полностью переопределяет аргументы; пусто — используется набор по умолчанию.
	Args []string
	// AllowedTools и DisallowedTools задают права скилла. По умолчанию — только чтение.
	AllowedTools    []string
	DisallowedTools []string
	Env             map[string]string
	Timeout         time.Duration
}

var (
	defaultAllowedTools    = []string{"Read", "Glob", "Grep"}
	defaultDisallowedTools = []string{"Write", "Edit", "Bash", "WebFetch", "WebSearch"}
)

func (p CommandProvider) arguments(request Request) []string {
	if len(p.Args) > 0 {
		return append([]string(nil), p.Args...)
	}
	allowed := p.AllowedTools
	if len(allowed) == 0 {
		allowed = defaultAllowedTools
	}
	disallowed := p.DisallowedTools
	if len(disallowed) == 0 {
		disallowed = defaultDisallowedTools
	}
	args := []string{"-p", request.Prompt, "--output-format", "json"}
	if request.OnActivity != nil {
		args = []string{"-p", request.Prompt, "--output-format", "stream-json", "--verbose"}
	}
	if request.RepoPath != "" {
		args = append(args, "--add-dir", request.RepoPath)
	}
	args = append(args, "--allowed-tools")
	args = append(args, allowed...)
	args = append(args, "--disallowed-tools")
	args = append(args, disallowed...)
	return args
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

	cmd := exec.CommandContext(ctx, p.Binary, p.arguments(request)...)
	cmd.Dir = p.ProjectDir
	cmd.Env = safeEnv(p.Env)
	var raw []byte
	var err error
	if request.OnActivity != nil && len(p.Args) == 0 {
		var stdout io.ReadCloser
		stdout, err = cmd.StdoutPipe()
		if err == nil {
			err = cmd.Start()
		}
		if err == nil {
			raw, err = readStream(stdout, request)
			if err != nil {
				contextErr := ctx.Err()
				cancel()
				_ = cmd.Wait()
				if contextErr != nil {
					return Response{}, fmt.Errorf("provider timeout: %w", contextErr)
				}
				return Response{}, fmt.Errorf("read provider stream: %w", err)
			}
			waitErr := cmd.Wait()
			if err == nil {
				err = waitErr
			}
		}
	} else {
		raw, err = cmd.Output()
	}
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
	report, usage := unwrapEnvelope(raw)
	return Response{Raw: report, Usage: usage}, nil
}

// unwrapEnvelope достаёт отчёт из обёртки `claude -p --output-format json`.
// Обёртка же несёт стоимость и расход токенов, поэтому прогон становится
// учитываемым (спека 003 FR-035). Если обёртки нет, вход возвращается как есть:
// это допустимо, чтобы тот же путь работал с заранее записанным отчётом.
func unwrapEnvelope(raw []byte) ([]byte, Usage) {
	var envelope struct {
		Result       string  `json:"result"`
		TotalCostUSD float64 `json:"total_cost_usd"`
		IsError      bool    `json:"is_error"`
		Usage        struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil || strings.TrimSpace(envelope.Result) == "" {
		return raw, DecodeUsage(raw)
	}
	usage := Usage{
		InputTokens:  envelope.Usage.InputTokens,
		OutputTokens: envelope.Usage.OutputTokens,
		CostUSD:      envelope.TotalCostUSD,
	}
	return []byte(envelope.Result), usage
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
