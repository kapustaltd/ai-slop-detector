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
	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
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

func (f *fakeEvaluator) EvaluateWithProgressAndJob(ctx context.Context, team registry.Team, report func(string), onJob func(string)) error {
	onJob("job-1")
	report("analyzing")
	return f.Evaluate(ctx, team)
}
func scorePtr(value float64) *float64 { return &value }

func TestReadProgressSnapshotIsRunScopedAndRejectsStaleData(t *testing.T) {
	root := t.TempDir()
	service := &evaluationService{publicDir: filepath.Join(root, "public")}
	started := time.Date(2026, 9, 24, 10, 0, 0, 900_000_000, time.UTC)
	path := filepath.Join(root, "runs", "job-new", "progress", "alpha.json")
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		t.Fatal(err)
	}
	fallback := evaluationProgress{Status: "running", Stage: "dispatching", StartedAt: started.Format(time.RFC3339), Areas: []contract.AreaProgress{}, Events: []contract.Event{}}
	write := func(at string) {
		t.Helper()
		data, err := json.Marshal(evaluationProgress{Status: "running", Stage: "analyzing", StartedAt: at, Areas: []contract.AreaProgress{{Area: "backend", Status: "running"}}, Events: []contract.Event{{Sequence: 1, At: at, Kind: "scan", Title: "Файлы проверены"}}})
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, data, 0600); err != nil {
			t.Fatal(err)
		}
	}
	write(started.Add(-time.Minute).Format(time.RFC3339))
	stale := service.readProgressSnapshot("alpha", "job-new", started, fallback)
	if stale.Stage != "dispatching" || len(stale.Events) != 0 {
		t.Fatalf("stale progress leaked: %+v", stale)
	}
	write(started.Add(50 * time.Millisecond).Format(time.RFC3339))
	current := service.readProgressSnapshot("alpha", "job-new", started, fallback)
	if current.Stage != "analyzing" || len(current.Events) != 1 {
		t.Fatalf("current progress missing: %+v", current)
	}
	otherJob := service.readProgressSnapshot("alpha", "job-old", started, fallback)
	if otherJob.Stage != "dispatching" || len(otherJob.Events) != 0 {
		t.Fatalf("snapshot from another job leaked: %+v", otherJob)
	}
}

func TestRunningTeamReadsCurrentRunnerOutput(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: alpha\n    name: Alpha\n    repo: https://github.com/example/alpha\n    branch: main\n    active: true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	public := filepath.Join(root, "public")
	if err := server.ConfigureEvaluation(public, nil, 10); err != nil {
		t.Fatal(err)
	}
	started := time.Now().UTC().Add(-time.Minute)
	server.evaluation.started["alpha"] = started
	server.evaluation.states["alpha"] = "running"
	server.evaluation.jobIDs["alpha"] = "job-123"
	teamDir := filepath.Join(root, "runs", "job-123", "teams")
	if err := os.MkdirAll(teamDir, 0750); err != nil {
		t.Fatal(err)
	}
	score := 8.0
	partial := bundle.Team{BuiltAt: time.Now().UTC().Format(time.RFC3339), TeamID: "alpha", Name: "Alpha", Status: "running", Areas: map[string]bundle.Area{"backend": {Status: "done", Score: &score}}}
	data, _ := json.Marshal(partial)
	if err := os.WriteFile(filepath.Join(teamDir, "alpha.json"), data, 0640); err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/alpha", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("partial team: %d %s", response.Code, response.Body.String())
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/index", nil))
	var index bundle.Index
	if err := json.Unmarshal(response.Body.Bytes(), &index); err != nil {
		t.Fatal(err)
	}
	if len(index.Teams) != 1 || index.Teams[0].Status != "running" || index.Teams[0].Total != nil || index.Teams[0].Areas["backend"] != score {
		t.Fatalf("partial index: %+v", index.Teams)
	}
}

func TestRunningTeamReadsCompletedAreaStateFromDeployedRunner(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: alpha\n    name: Alpha\n    repo: https://github.com/example/alpha\n    branch: main\n    active: true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := server.ConfigureEvaluation(filepath.Join(root, "public"), nil, 10); err != nil {
		t.Fatal(err)
	}
	server.evaluation.started["alpha"] = time.Now().UTC().Add(-time.Minute)
	server.evaluation.states["alpha"] = "running"
	server.evaluation.jobIDs["alpha"] = "job-123"
	stateDir := filepath.Join(root, "runs", "job-123", "state", "alpha")
	if err := os.MkdirAll(stateDir, 0750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(stateDir, "backend.json"), []byte(`{"team_id":"alpha","area":"backend","status":"done","aggregate":{"score":8,"max":10}}`), 0640); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/alpha", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("state partial: %d %s", response.Code, response.Body.String())
	}
	var team bundle.Team
	if err := json.Unmarshal(response.Body.Bytes(), &team); err != nil {
		t.Fatal(err)
	}
	if team.Name != "Alpha" || team.Total != nil || team.Areas["backend"].Score == nil || *team.Areas["backend"].Score != 8 {
		t.Fatalf("partial from state: %+v", team)
	}
}

func TestRunningTeamExposesPublishedAreasWithoutFinalScore(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: alpha\n    name: Alpha\n    repo: https://github.com/example/alpha\n    branch: main\n    active: true\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	public := filepath.Join(root, "public")
	if err := os.MkdirAll(filepath.Join(public, "teams"), 0750); err != nil {
		t.Fatal(err)
	}
	index := bundle.Index{BundleSchema: bundle.SchemaVersion, Teams: []bundle.IndexTeam{{TeamID: "alpha", Name: "Alpha", Status: "done", Total: scorePtr(8), Areas: map[string]float64{"backend": 8}}}}
	data, _ := json.Marshal(index)
	if err := os.WriteFile(filepath.Join(public, "index.json"), data, 0640); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(public, "teams", "alpha.json"), []byte(`{"team_id":"alpha","areas":{"backend":{"status":"done","score":8}}}`), 0640); err != nil {
		t.Fatal(err)
	}
	if err := server.ConfigureEvaluation(public, nil, 10); err != nil {
		t.Fatal(err)
	}
	server.evaluation.states["alpha"] = "running"
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/index", nil))
	if response.Code != 200 {
		t.Fatalf("index: %d", response.Code)
	}
	var live bundle.Index
	if err := json.Unmarshal(response.Body.Bytes(), &live); err != nil {
		t.Fatal(err)
	}
	if len(live.Teams) != 1 || live.Teams[0].Status != "running" || live.Teams[0].Total != nil || live.Teams[0].Areas["backend"] != 8 {
		t.Fatalf("live index: %+v", live.Teams)
	}
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/alpha", nil))
	if response.Code != 200 {
		t.Fatalf("published area: %d", response.Code)
	}
	server.evaluation.started["alpha"] = time.Now().UTC()
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/index", nil))
	live = bundle.Index{}
	if err := json.Unmarshal(response.Body.Bytes(), &live); err != nil {
		t.Fatal(err)
	}
	if len(live.Teams) != 1 || len(live.Teams[0].Areas) != 0 {
		t.Fatalf("stale areas exposed: %+v", live.Teams)
	}
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/alpha", nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("stale report exposed: %d", response.Code)
	}
	currentBuiltAt := time.Now().UTC().Add(time.Second).Format(time.RFC3339)
	index.BuiltAt = currentBuiltAt
	data, _ = json.Marshal(index)
	if err := os.WriteFile(filepath.Join(public, "index.json"), data, 0640); err != nil {
		t.Fatal(err)
	}
	partial, _ := json.Marshal(bundle.Team{BuiltAt: currentBuiltAt, TeamID: "alpha", Areas: map[string]bundle.Area{"backend": {Status: "done"}}})
	if err := os.WriteFile(filepath.Join(public, "teams", "alpha.json"), partial, 0640); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/bundle/teams/alpha", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("current partial report unavailable: %d", response.Code)
	}
}

func TestCreateQueuesEvaluationAndLiveIndexUpdates(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams: []\n"), 0600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path)
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
	progressPath := filepath.Join(root, "runs", "job-1", "progress", "new-team.json")
	if err := os.MkdirAll(filepath.Dir(progressPath), 0750); err != nil {
		t.Fatal(err)
	}
	startedAt := time.Now().UTC().Add(time.Second).Format(time.RFC3339)
	snapshot, _ := json.Marshal(evaluationProgress{
		Status: "running", Stage: "analyzing", StartedAt: startedAt,
		Areas:  []contract.AreaProgress{{Area: "backend", Status: "running", IncludedFiles: 12, TotalCategories: 8}},
		Events: []contract.Event{{Sequence: 1, At: startedAt, Kind: "scan", Title: "Структура файлов проверена"}},
	})
	if err := os.WriteFile(progressPath, snapshot, 0600); err != nil {
		t.Fatal(err)
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
	progressResponse := httptest.NewRecorder()
	handler.ServeHTTP(progressResponse, httptest.NewRequest(http.MethodGet, "/api/evaluation/progress/new-team", nil))
	var progress evaluationProgress
	if err := json.Unmarshal(progressResponse.Body.Bytes(), &progress); err != nil {
		t.Fatal(err)
	}
	if progressResponse.Code != http.StatusOK || progress.Status != "running" || progress.Stage != "analyzing" || progress.StartedAt == "" || len(progress.Events) != 1 || progress.Areas[0].IncludedFiles != 12 {
		t.Fatalf("progress during evaluation: %+v", progress)
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
	progressResponse = httptest.NewRecorder()
	handler.ServeHTTP(progressResponse, httptest.NewRequest(http.MethodGet, "/api/evaluation/progress/new-team", nil))
	if err := json.Unmarshal(progressResponse.Body.Bytes(), &progress); err != nil {
		t.Fatal(err)
	}
	if progress.Status != "done" || progress.Stage != "done" {
		t.Fatalf("completed progress: %+v", progress)
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
	server, _ := New(path)
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
			progressResponse := httptest.NewRecorder()
			handler.ServeHTTP(progressResponse, httptest.NewRequest(http.MethodGet, "/api/evaluation/progress/new-team", nil))
			var progress evaluationProgress
			if err := json.Unmarshal(progressResponse.Body.Bytes(), &progress); err != nil {
				t.Fatal(err)
			}
			if progress.Status != "failed" || progress.Stage != "analyzing" {
				t.Fatalf("failed progress: %+v", progress)
			}
			return
		}
		time.Sleep(time.Millisecond * 5)
	}
	t.Fatal("failed status was not published")
}
