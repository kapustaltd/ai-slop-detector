package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	BaseURL          string
	APIKey           string
	Model            string
	Effort           string
	Timeout          time.Duration
	MaxResponseBytes int64
}

type Client struct {
	config     Config
	httpClient *http.Client
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatRequest struct {
	Model           string    `json:"model"`
	Messages        []Message `json:"messages"`
	Temperature     *float64  `json:"temperature,omitempty"`
	ReasoningEffort string    `json:"reasoning_effort,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func ConfigFromEnv() (Config, error) {
	config := Config{
		BaseURL:          strings.TrimRight(os.Getenv("AGENT_BASE_URL"), "/"),
		APIKey:           os.Getenv("AGENT_API_KEY"),
		Model:            os.Getenv("AGENT_MODEL"),
		Effort:           os.Getenv("AGENT_EFFORT"),
		Timeout:          90 * time.Second,
		MaxResponseBytes: 512 * 1024,
	}
	if config.BaseURL == "" {
		config.BaseURL = "https://ru.cheapvibecode.ru/v1"
	}
	if config.Model == "" {
		config.Model = "gpt-5.6-luna"
	}
	if raw := os.Getenv("AGENT_TIMEOUT_SECONDS"); raw != "" {
		seconds, err := strconv.Atoi(raw)
		if err != nil || seconds < 1 || seconds > 600 {
			return Config{}, errors.New("AGENT_TIMEOUT_SECONDS must be an integer from 1 to 600")
		}
		config.Timeout = time.Duration(seconds) * time.Second
	}
	if raw := os.Getenv("AGENT_MAX_RESPONSE_BYTES"); raw != "" {
		bytesLimit, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || bytesLimit < 1024 || bytesLimit > 10*1024*1024 {
			return Config{}, errors.New("AGENT_MAX_RESPONSE_BYTES must be between 1024 and 10485760")
		}
		config.MaxResponseBytes = bytesLimit
	}
	if strings.TrimSpace(config.APIKey) == "" {
		return Config{}, errors.New("AGENT_API_KEY is required and must be provided through the environment")
	}
	if _, err := url.ParseRequestURI(config.BaseURL); err != nil {
		return Config{}, fmt.Errorf("invalid AGENT_BASE_URL: %w", err)
	}
	return config, nil
}

func New(config Config) (*Client, error) {
	if strings.TrimSpace(config.APIKey) == "" {
		return nil, errors.New("provider API key is empty")
	}
	if strings.TrimSpace(config.BaseURL) == "" || strings.TrimSpace(config.Model) == "" {
		return nil, errors.New("provider base URL and model are required")
	}
	if config.Timeout <= 0 {
		config.Timeout = 90 * time.Second
	}
	if config.MaxResponseBytes <= 0 {
		config.MaxResponseBytes = 512 * 1024
	}
	return &Client{config: config, httpClient: &http.Client{Timeout: config.Timeout}}, nil
}

func (c *Client) Complete(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	endpoint := strings.TrimRight(c.config.BaseURL, "/") + "/chat/completions"
	payload := chatRequest{
		Model: c.config.Model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}
	if c.config.Effort != "" && c.config.Effort != "none" {
		payload.ReasoningEffort = c.config.Effort
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("encode provider request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create provider request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call provider: %w", err)
	}
	defer resp.Body.Close()
	limited := io.LimitReader(resp.Body, c.config.MaxResponseBytes)
	responseBody, err := io.ReadAll(limited)
	if err != nil {
		return "", fmt.Errorf("read provider response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("provider returned HTTP %d: %s", resp.StatusCode, safeErrorBody(responseBody))
	}
	var response chatResponse
	if err := json.Unmarshal(responseBody, &response); err != nil {
		return "", fmt.Errorf("decode provider response: %w", err)
	}
	if len(response.Choices) == 0 || strings.TrimSpace(response.Choices[0].Message.Content) == "" {
		return "", errors.New("provider response contains no assistant content")
	}
	return response.Choices[0].Message.Content, nil
}

func safeErrorBody(body []byte) string {
	text := strings.TrimSpace(string(body))
	if len(text) > 500 {
		text = text[:500] + "…"
	}
	for _, marker := range []string{"sk-", "Bearer ", "api_key", "api-key", "token"} {
		if index := strings.Index(strings.ToLower(text), strings.ToLower(marker)); index >= 0 {
			text = text[:index] + "[REDACTED]"
		}
	}
	if text == "" {
		return "empty response body"
	}
	return text
}
