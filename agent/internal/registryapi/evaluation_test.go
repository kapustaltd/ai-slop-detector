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

type fakeEvaluator struct {
	started   chan struct{}
	release   chan struct{}
	publicDir string
	fail      bool
}

func (f *fakeEvaluator) Evaluate(_ context.Context, team registry.Team) error {
	close(f.started)
	<-f.release
	if f.fail {
		return os.ErrPermission
	}
	if err := os.MkdirAll(filepath.Join(f.publicDir, "teams"), 0750); err != nil {
		return err
	}
	index := bundle.Index{BundleSchema: bundle.SchemaVersion, BuiltAt: time.Now().UTC().Format(time.RFC3339), Meta: bundle.Meta{BundleSchema: bundle.SchemaVersion, BuiltAt: time.Now().UTC().Format(time.RFC3339), ReportSchema: "1.0", RubricVersions: []string{}, SkillVersions: []string{}, Models: []string{}}, Teams: []bundle.IndexTeam{{TeamID: team.ID, Name: team.Name, Status: "done", Total: scorePtr(8), Areas: map[string]float64{"frontend": 8}}}}
	data, _ := json.Marshal(index)
	if err := os.WriteFile(filepath.Join(f.publicDir, "index.json"), data, 0640); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(f.publicDir, "teams", team.ID+".json"), []byte(`{"team_id":"new-team","name":"New team","status":"done","total":8,"areas":{}}`), 0640)
}
func scorePtr(value float64) *float64 { return &value }

func TestCreateQueuesEvaluationAndLiveIndexUpdates(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams: []\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path, "")
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeEvaluator{started: make(chan struct{}), release: make(chan struct{}), publicDir: filepath.Join(root, "public")}
	if err := server.ConfigureEvaluation(fake.publicDir, fake, 10); err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"new-team","name":"New team","repo":"https://github.com/example/new","branch":"main","active":true}`)))
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	select {
	case <-fake.started:
	case <-time.After(time.Second):
		t.Fatal("evaluation did not start")
	}
	getIndex := func() bundle.Index {
		t.Helper()
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/index", nil))
		if response.Code != 200 {
			t.Fatalf("index: %d", response.Code)
		}
		var value bundle.Index
		if err := json.Unmarshal(response.Body.Bytes(), &value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	if got := getIndex().Teams[0].Status; got != "running" {
		t.Fatalf("status during evaluation: %s", got)
	}
	close(fake.release)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if getIndex().Teams[0].Status == "done" {
			break
		}
		time.Sleep(time.Millisecond * 5)
	}
	index := getIndex()
	if len(index.Teams) != 1 || index.Teams[0].Status != "done" || index.Teams[0].Total == nil || *index.Teams[0].Total != 8 {
		t.Fatalf("completed index: %+v", index.Teams)
	}
	team := httptest.NewRecorder()
	handler.ServeHTTP(team, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/new-team", nil))
	if team.Code != 200 {
		t.Fatalf("team bundle: %d %s", team.Code, team.Body.String())
	}
}

func TestEvaluationFailureIsVisibleWithoutScore(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams: []\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, _ := New(path, "")
	fake := &fakeEvaluator{started: make(chan struct{}), release: make(chan struct{}), publicDir: filepath.Join(root, "public"), fail: true}
	if err := server.ConfigureEvaluation(fake.publicDir, fake, 10); err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	created := httptest.NewRecorder()
	handler.ServeHTTP(created, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"new-team","name":"New team","repo":"https://github.com/example/new","branch":"main","active":true}`)))
	<-fake.started
	close(fake.release)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/index", nil))
		var index bundle.Index
		_ = json.Unmarshal(response.Body.Bytes(), &index)
		if len(index.Teams) == 1 && index.Teams[0].Status == "failed" {
			if index.Teams[0].Total != nil {
				t.Fatal("failed team has score")
			}
			return
		}
		time.Sleep(time.Millisecond * 5)
	}
	t.Fatal("failed status was not published")
}
