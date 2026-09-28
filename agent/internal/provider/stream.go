package provider

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// Activity contains only public progress summaries and tool metadata, never
// thinking blocks, tool output, search expressions, or repository contents.
type Activity struct {
	Kind, Title, Detail, CategoryID, ToolID, State string
}

func readStream(reader io.Reader, request Request) ([]byte, error) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	var result []byte
	tools := map[string]string{}
	currentCategory := ""
	emit := func(a Activity) {
		if request.OnActivity != nil {
			request.OnActivity(a)
		}
	}
	for scanner.Scan() {
		line := scanner.Bytes()
		var message struct {
			Type    string `json:"type"`
			IsError bool   `json:"is_error"`
			Message struct {
				Usage   *Usage `json:"usage"`
				Content []struct {
					Type      string `json:"type"`
					Name      string `json:"name"`
					ID        string `json:"id"`
					ToolUseID string `json:"tool_use_id"`
					IsError   bool   `json:"is_error"`
					Text      string `json:"text"`
					Input     struct {
						FilePath string `json:"file_path"`
						Path     string `json:"path"`
					} `json:"input"`
				} `json:"content"`
			} `json:"message"`
		}
		if err := json.Unmarshal(line, &message); err != nil {
			return nil, fmt.Errorf("invalid provider stream: %w", err)
		}
		switch message.Type {
		case "result":
			if message.IsError {
				return nil, fmt.Errorf("provider reported a failed result")
			}
			result = bytes.Clone(line)
		case "assistant", "user":
			if message.Message.Usage != nil && request.OnUsage != nil {
				request.OnUsage(*message.Message.Usage)
			}
			for _, block := range message.Message.Content {
				switch block.Type {
				case "tool_use":
					if block.Name != "Read" && block.Name != "Glob" && block.Name != "Grep" {
						continue
					}
					tools[block.ID] = block.Name
					path := block.Input.FilePath
					if path == "" {
						path = block.Input.Path
					}
					detail := "Проверка файлов репозитория"
					if path != "" {
						if !filepath.IsAbs(path) {
							path = filepath.Join(request.RepoPath, path)
						}
						if relative, err := filepath.Rel(request.RepoPath, path); err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
							detail = filepath.ToSlash(relative)
						}
					}
					emit(Activity{Kind: "tool", Title: block.Name, Detail: detail, ToolID: block.ID, CategoryID: currentCategory, State: "running"})
				case "tool_result":
					if name, ok := tools[block.ToolUseID]; ok {
						state, detail := "done", "Инструмент завершил работу"
						if block.IsError {
							state, detail = "failed", "Инструмент вернул ошибку"
						}
						emit(Activity{Kind: "tool", Title: name, Detail: detail, ToolID: block.ToolUseID, State: state})
						delete(tools, block.ToolUseID)
					}
				case "text":
					// Explicit public summaries are separate from private model reasoning.
					for _, line := range strings.Split(block.Text, "\n") {
						if !strings.HasPrefix(line, "PROGRESS ") {
							continue
						}
						var summary struct {
							Category string `json:"category"`
							Summary  string `json:"summary"`
						}
						if json.Unmarshal([]byte(strings.TrimPrefix(line, "PROGRESS ")), &summary) == nil && request.Categories[summary.Category] != "" && summary.Summary != "" {
							currentCategory = summary.Category
							emit(Activity{Kind: "stage", Title: request.Categories[summary.Category], CategoryID: summary.Category, Detail: summary.Summary, State: "running"})
						}
					}
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("provider stream ended without a result")
	}
	return result, nil
}
