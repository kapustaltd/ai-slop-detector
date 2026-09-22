package webapi

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

type testBundleReader map[string][]byte

func (reader testBundleReader) Read(path string) ([]byte, error) {
	value, ok := reader[path]
	if !ok {
		return nil, os.ErrNotExist
	}
	return value, nil
}

func testManager(t *testing.T, execute Execute) *Manager {
	t.Helper()
	manager, err := NewManager(Config{DataDir: t.TempDir(), Execute: execute, Now: func() time.Time { return time.Date(2026, 9, 22, 12, 0, 0, 0, time.UTC) }})
	if err != nil {
		t.Fatal(err)
	}
	return manager
}

func validPayload() string {
	return `{"repository_url":"https://github.com/example/team-01.git","repository_id":"team-01","branch":"main","area":"both"}`
}

func TestValidateRequestRejectsUnsafeValues(t *testing.T) {
	cases := []Request{
		{RepositoryURL: "https://evil.example/repo.git", RepositoryID: "team-01", Branch: "main", Area: "both"},
		{RepositoryURL: "https://github.com/example/repo.git", RepositoryID: "team-01", Branch: "main;rm", Area: "both"},
		{RepositoryURL: "https://user:pass@github.com/example/repo.git", RepositoryID: "team-01", Branch: "main", Area: "both"},
		{RepositoryURL: "https://github.com/example/repo.git", RepositoryID: "team-01", Branch: "main", Area: "shell"},
	}
	for _, value := range cases {
		if err := ValidateRequest(value); err == nil {
			t.Fatalf("expected request to be rejected: %#v", value)
		}
	}
}

func TestHTTPAuthValidationAndRunLifecycle(t *testing.T) {
	started := make(chan struct{})
	release := make(chan struct{})
	manager := testManager(t, func(context.Context, Request, io.Writer) (Summary, error) {
		close(started)
		<-release
		return Summary{TeamsTotal: 1, TeamsDone: 1}, nil
	})
	handler := NewHandler(manager, "operator-token")

	unauthorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/runs", strings.NewReader(validPayload()))
	handler.ServeHTTP(unauthorized, request)
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", unauthorized.Code)
	}

	created := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/api/v1/runs", strings.NewReader(validPayload()))
	request.Header.Set("Authorization", "Bearer operator-token")
	handler.ServeHTTP(created, request)
	if created.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", created.Code)
	}
	if created.Header().Get("Location") == "" {
		t.Fatal("Location header is missing")
	}
	<-started

	busy := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/api/v1/runs", strings.NewReader(validPayload()))
	request.Header.Set("Authorization", "Bearer operator-token")
	handler.ServeHTTP(busy, request)
	if busy.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", busy.Code)
	}

	close(release)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		job, err := manager.Get(strings.TrimPrefix(created.Header().Get("Location"), "/api/v1/runs/"))
		if err != nil {
			t.Fatal(err)
		}
		if job.Status == StatusSucceeded {
			if job.Summary == nil || job.Summary.TeamsDone != 1 {
				t.Fatalf("unexpected summary: %#v", job.Summary)
			}
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("run did not finish")
}

func TestHTTPRejectsUnknownJSONField(t *testing.T) {
	manager := testManager(t, func(context.Context, Request, io.Writer) (Summary, error) { return Summary{}, nil })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/runs", strings.NewReader(`{"repository_url":"https://github.com/example/repo.git","repository_id":"repo","branch":"main","area":"backend","command":"rm -rf /"}`))
	NewHandler(manager, "").ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
}

func TestHTTPServesPublicBundleWithoutOperatorToken(t *testing.T) {
	manager := testManager(t, func(context.Context, Request, io.Writer) (Summary, error) { return Summary{}, nil })
	handler := NewHandler(manager, "operator-token", testBundleReader{"index.json": []byte(`{"teams":[]}`)})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/bundle/index.json", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("unexpected public bundle response: status=%d headers=%v", recorder.Code, recorder.Header())
	}

	invalid := httptest.NewRecorder()
	handler.ServeHTTP(invalid, httptest.NewRequest(http.MethodGet, "/api/v1/bundle/teams/private/file.json", nil))
	if invalid.Code != http.StatusNotFound {
		t.Fatalf("nested asset status = %d, want 404", invalid.Code)
	}
}

func TestHTTPMarksSummaryFailuresAsFailed(t *testing.T) {
	manager := testManager(t, func(context.Context, Request, io.Writer) (Summary, error) {
		return Summary{TeamsTotal: 1, TeamsFailed: 1, AreasFailed: 2}, nil
	})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/runs", strings.NewReader(validPayload()))
	NewHandler(manager, "").ServeHTTP(recorder, request)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", recorder.Code)
	}

	runID := strings.TrimPrefix(recorder.Header().Get("Location"), "/api/v1/runs/")
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		job, err := manager.Get(runID)
		if err != nil {
			t.Fatal(err)
		}
		if job.Status == StatusFailed {
			if job.Summary == nil || job.Summary.AreasFailed != 2 {
				t.Fatalf("failure summary was not preserved: %#v", job.Summary)
			}
			if job.Error == "" || job.Progress["backend"] != StatusFailed || job.Progress["frontend"] != StatusFailed {
				t.Fatalf("failure state is incomplete: %#v", job)
			}
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("run did not finish as failed")
}

func TestNewManagerNormalizesPersistedSummaryFailures(t *testing.T) {
	dataDir := t.TempDir()
	manager, err := NewManager(Config{DataDir: dataDir, Execute: func(context.Context, Request, io.Writer) (Summary, error) {
		return Summary{}, nil
	}})
	if err != nil {
		t.Fatal(err)
	}

	job := &Job{
		ID: "persisted-run", Status: StatusSucceeded, Area: "both",
		Progress: progressFor("both", StatusSucceeded),
		Summary:  &Summary{TeamsTotal: 1, TeamsFailed: 1, AreasFailed: 2},
	}
	if err := manager.persistLocked(job); err != nil {
		t.Fatal(err)
	}

	reloaded, err := NewManager(Config{DataDir: dataDir, Execute: func(context.Context, Request, io.Writer) (Summary, error) {
		return Summary{}, nil
	}})
	if err != nil {
		t.Fatal(err)
	}
	got, err := reloaded.Get("persisted-run")
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != StatusFailed || got.Error == "" || got.Progress["backend"] != StatusFailed {
		t.Fatalf("persisted failure was not normalized: %#v", got)
	}
}
