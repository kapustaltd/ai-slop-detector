package registryapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

// RemoteEvaluator delegates model work to the already deployed, authenticated
// web runner. The token never goes to the browser or the team repository.
type RemoteEvaluator struct {
	URL, Token   string
	Client       *http.Client
	PollInterval time.Duration
}

func (e RemoteEvaluator) Evaluate(ctx context.Context, team registry.Team) error {
	if e.URL == "" || e.Token == "" {
		return errors.New("runner URL and token are required")
	}
	client := e.Client
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	interval := e.PollInterval
	if interval <= 0 {
		interval = 3 * time.Second
	}
	input, _ := json.Marshal(map[string]string{
		"repository_url": team.Repo, "repository_id": team.ID, "branch": team.Branch, "area": "both",
	})
	var jobID string
	for jobID == "" {
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(e.URL, "/")+"/api/v1/runs", bytes.NewReader(input))
		if err != nil {
			return err
		}
		request.Header.Set("Authorization", "Bearer "+e.Token)
		request.Header.Set("Content-Type", "application/json")
		response, err := client.Do(request)
		if err != nil {
			return fmt.Errorf("create evaluation run: %w", err)
		}
		var body struct {
			Data struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		decodeErr := json.NewDecoder(response.Body).Decode(&body)
		_ = response.Body.Close()
		if response.StatusCode == http.StatusTooManyRequests {
			if err := waitForEvaluation(ctx, interval); err != nil {
				return err
			}
			continue
		}
		if response.StatusCode != http.StatusAccepted || decodeErr != nil || body.Data.ID == "" {
			return fmt.Errorf("runner rejected evaluation request (HTTP %d)", response.StatusCode)
		}
		jobID = body.Data.ID
	}
	for {
		if err := waitForEvaluation(ctx, interval); err != nil {
			return err
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(e.URL, "/")+"/api/v1/runs/"+jobID, nil)
		if err != nil {
			return err
		}
		request.Header.Set("Authorization", "Bearer "+e.Token)
		response, err := client.Do(request)
		if err != nil {
			return fmt.Errorf("read evaluation state: %w", err)
		}
		var body struct {
			Data struct {
				Status string `json:"status"`
			} `json:"data"`
		}
		decodeErr := json.NewDecoder(response.Body).Decode(&body)
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK || decodeErr != nil {
			return fmt.Errorf("runner state unavailable (HTTP %d)", response.StatusCode)
		}
		switch body.Data.Status {
		case "succeeded":
			return nil
		case "failed":
			return errors.New("runner evaluation failed")
		case "queued", "running":
		default:
			return errors.New("runner returned unknown evaluation state")
		}
	}
}

func waitForEvaluation(ctx context.Context, interval time.Duration) error {
	timer := time.NewTimer(interval)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
