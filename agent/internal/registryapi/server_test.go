package registryapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/bundle"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

type retryEvaluator struct {
	started chan struct{}
	release chan struct{}
}

func (e *retryEvaluator) Evaluate(context.Context, registry.Team) error {
	close(e.started)
	<-e.release
	return nil
}

func TestAnonymousTeamCreationUpdateAndDeletion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: existing\n    name: Existing\n    repo: https://github.com/example/existing\n    branch: main\n    active: true\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"new-team","name":"New team","repo":"https://github.com/example/new","branch":"main","active":true}`)))
	if create.Code != http.StatusCreated {
		t.Fatalf("anonymous create: %d %s", create.Code, create.Body.String())
	}
	stored, err := registry.Load(path)
	if err != nil || len(stored.Teams) != 2 {
		t.Fatalf("created team was not persisted: teams=%d err=%v", len(stored.Teams), err)
	}
	update := httptest.NewRecorder()
	handler.ServeHTTP(update, httptest.NewRequest(http.MethodPut, "/api/teams/new-team", strings.NewReader(`{"name":"Updated","repo":"https://github.com/example/new","branch":"main","active":true}`)))
	if update.Code != http.StatusOK {
		t.Errorf("anonymous PUT: got %d, want 200: %s", update.Code, update.Body.String())
	}
	remove := httptest.NewRecorder()
	handler.ServeHTTP(remove, httptest.NewRequest(http.MethodDelete, "/api/teams/new-team", nil))
	if remove.Code != http.StatusNoContent {
		t.Errorf("anonymous DELETE: got %d, want 204: %s", remove.Code, remove.Body.String())
	}
}

func TestAnonymousTeamCreationFromEmptyRegistry(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams: []\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"first","name":"First","repo":"https://github.com/example/first","branch":"main","active":true}`)))
	if response.Code != http.StatusCreated {
		t.Fatalf("first team: %d %s", response.Code, response.Body.String())
	}
}

func TestFailedTeamCanBeRetried(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: failed-team\n    name: Failed team\n    repo: https://github.com/example/failed\n    branch: main\n    active: true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	publicDir := filepath.Join(root, "public")
	if err := os.MkdirAll(filepath.Join(publicDir, "teams"), 0750); err != nil {
		t.Fatal(err)
	}
	index, _ := json.Marshal(bundle.Index{
		BundleSchema: bundle.SchemaVersion,
		Teams:        []bundle.IndexTeam{{TeamID: "failed-team", Name: "Failed team", Status: "failed"}},
	})
	if err := os.WriteFile(filepath.Join(publicDir, "index.json"), index, 0640); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	evaluator := &retryEvaluator{started: make(chan struct{}), release: make(chan struct{})}
	if err := server.ConfigureEvaluation(publicDir, evaluator, 10); err != nil {
		t.Fatal(err)
	}
	server.evaluation.mu.Lock()
	server.evaluation.states["failed-team"] = "failed"
	server.evaluation.mu.Unlock()

	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/teams/failed-team/retry", nil))
	if response.Code != http.StatusAccepted {
		t.Fatalf("retry: %d %s", response.Code, response.Body.String())
	}
	select {
	case <-evaluator.started:
	case <-time.After(time.Second):
		t.Fatal("retry evaluation did not start")
	}
	close(evaluator.release)

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		server.evaluation.mu.RLock()
		state := server.evaluation.progress["failed-team"].Status
		server.evaluation.mu.RUnlock()
		if state == "done" {
			return
		}
		time.Sleep(time.Millisecond * 5)
	}
	t.Fatal("retry evaluation did not finish")
}

func TestRetryRequiresFailedTeam(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: ready\n    name: Ready\n    repo: https://github.com/example/ready\n    branch: main\n    active: true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	server.evaluation = &evaluationService{
		evaluator: &retryEvaluator{},
		states:    map[string]string{"ready": "running"},
		progress:  map[string]evaluationProgress{},
		started:   map[string]time.Time{},
		jobIDs:    map[string]string{},
		queue:     make(chan string, 1),
		limit:     10,
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/teams/ready/retry", nil))
	if response.Code != http.StatusConflict {
		t.Fatalf("retry running team: %d %s", response.Code, response.Body.String())
	}
}
