package bundle

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

func TestPublisherMergesSeedAndReplacesExistingTeam(t *testing.T) {
	rubrics := map[string]rubric.Rubric{"backend.v1": {
		ID: "backend.v1", Version: "backend.v1", Area: "backend",
		Scale: rubric.Scale{Min: 0, Max: 10}, AreaWeights: map[string]float64{"backend": 1},
	}}
	seed := t.TempDir()
	run := t.TempDir()
	public := filepath.Join(t.TempDir(), "public")
	oldScore, newScore, secondScore := 4.0, 9.0, 7.0
	write := func(root string, values ...InputTeam) {
		t.Helper()
		if err := Write(root, time.Now(), values, rubrics); err != nil {
			t.Fatal(err)
		}
	}
	write(seed,
		InputTeam{Registry: registry.Team{ID: "team-a", Name: "Team A"}, Status: "done", Total: &oldScore, Areas: map[string]Area{}},
		InputTeam{Registry: registry.Team{ID: "team-b", Name: "Team B"}, Status: "done", Total: &secondScore, Areas: map[string]Area{}},
	)
	write(run, InputTeam{Registry: registry.Team{ID: "team-a", Name: "Team A"}, Status: "done", Total: &newScore, Areas: map[string]Area{}})

	publisher, err := NewPublisher(public, seed, rubrics)
	if err != nil {
		t.Fatal(err)
	}
	if err := publisher.Publish(run, time.Date(2026, 9, 22, 12, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	data, err := publisher.Read("index.json")
	if err != nil {
		t.Fatal(err)
	}
	var index Index
	if err := json.Unmarshal(data, &index); err != nil {
		t.Fatal(err)
	}
	if len(index.Teams) != 2 || index.Teams[0].TeamID != "team-a" || index.Teams[0].Total == nil || *index.Teams[0].Total != newScore {
		t.Fatalf("unexpected merged index: %#v", index.Teams)
	}
	if _, err := os.Stat(filepath.Join(public, "teams", "team-b.json")); err != nil {
		t.Fatal(err)
	}
}

func TestPublisherPreservesIndexOnlySeedTeams(t *testing.T) {
	rubrics := map[string]rubric.Rubric{"backend.v1": {
		ID: "backend.v1", Version: "backend.v1", Area: "backend",
		Scale: rubric.Scale{Min: 0, Max: 10}, AreaWeights: map[string]float64{"backend": 1},
	}}
	seed := t.TempDir()
	run := t.TempDir()
	public := filepath.Join(t.TempDir(), "public")
	seedScore, runScore := 6.0, 8.0
	seedIndex := Index{BundleSchema: SchemaVersion, BuiltAt: time.Now().Format(time.RFC3339), Teams: []IndexTeam{{TeamID: "index-only", Name: "Index only", Total: &seedScore, Areas: map[string]float64{"backend": seedScore}, Status: "done"}}}
	seedData, _ := json.Marshal(seedIndex)
	if err := os.WriteFile(filepath.Join(seed, "index.json"), seedData, 0o640); err != nil {
		t.Fatal(err)
	}
	if err := Write(run, time.Now(), []InputTeam{{Registry: registry.Team{ID: "new-team", Name: "New team"}, Status: "done", Total: &runScore, Areas: map[string]Area{}}}, rubrics); err != nil {
		t.Fatal(err)
	}
	publisher, err := NewPublisher(public, seed, rubrics)
	if err != nil {
		t.Fatal(err)
	}
	if err := publisher.Publish(run, time.Now()); err != nil {
		t.Fatal(err)
	}
	data, err := publisher.Read("index.json")
	if err != nil {
		t.Fatal(err)
	}
	var index Index
	if err := json.Unmarshal(data, &index); err != nil {
		t.Fatal(err)
	}
	if len(index.Teams) != 2 {
		t.Fatalf("index-only seed team was lost: %#v", index.Teams)
	}
}
