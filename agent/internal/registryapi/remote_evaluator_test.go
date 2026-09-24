package registryapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

func TestRemoteEvaluatorSubmitsAuthenticatedJobAndWaitsForSuccess(t *testing.T) {
	posts, polls := 0, 0
	runner := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer internal-token" {
			t.Errorf("missing internal auth")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/api/v1/runs" {
			posts++
			var input map[string]string
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
				t.Error(err)
			}
			if input["repository_id"] != "team" || input["repository_url"] != "https://github.com/org/repo" || input["area"] != "both" {
				t.Errorf("wrong job: %+v", input)
			}
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"data":{"id":"job-1"}}`))
			return
		}
		if r.Method == http.MethodGet && r.URL.Path == "/api/v1/runs/job-1" {
			polls++
			status := "succeeded"
			if polls == 1 {
				status = "queued"
			} else if polls == 2 {
				status = "running"
			}
			_, _ = w.Write([]byte(`{"data":{"status":"` + status + `"}}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer runner.Close()
	evaluator := RemoteEvaluator{URL: runner.URL, Token: "internal-token", PollInterval: time.Millisecond}
	var stages []string
	var jobID string
	if err := evaluator.EvaluateWithProgressAndJob(context.Background(), registry.Team{ID: "team", Repo: "https://github.com/org/repo", Branch: "main", Active: true}, func(stage string) { stages = append(stages, stage) }, func(id string) { jobID = id }); err != nil {
		t.Fatal(err)
	}
	if jobID != "job-1" {
		t.Fatalf("job ID = %q", jobID)
	}
	if posts != 1 || polls != 3 {
		t.Fatalf("posts=%d polls=%d", posts, polls)
	}
	if want := "dispatching,runner_queued,runner_queued,analyzing,publishing"; strings.Join(stages, ",") != want {
		t.Fatalf("stages=%v", stages)
	}
}
