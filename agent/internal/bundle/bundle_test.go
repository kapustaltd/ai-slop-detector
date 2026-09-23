package bundle

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

func TestWriteUsesStaticBundleContractShape(t *testing.T) {
	score := 8.0
	area := Area{Status: "done", Score: &score, Max: 10, Categories: []Category{{
		ID: "cat", Name: "Category", Weight: 1, Score: 8,
		Subcategories: []Subcategory{{
			ID: "sub", Name: "Sub", Weight: 1, Score: 8,
			Metrics: []Metric{{ID: "metric", Name: "Metric", Weight: 1, Score: 8, Max: 10, Confidence: "high", Summary: "summary", Rationale: "rationale", Findings: []enrichment.EnrichedFinding{{}}}},
		}},
	}}}
	total := 8.0
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "teams"), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "teams", "stale-team.json"), []byte("{}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	rubricValue := rubric.Rubric{ID: "backend.v1", Version: "backend.v1", Area: "backend", Scale: rubric.Scale{Min: 0, Max: 10, Anchors: []int{2, 5, 8, 10}}, AreaWeights: map[string]float64{"backend": .5, "frontend": .5}, Categories: []rubric.Category{{ID: "cat", Name: "Category", Weight: 1}}}
	err := Write(root, time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC), []InputTeam{{Registry: registry.Team{ID: "team-1", Name: "Team 1"}, Status: "done", Total: &total, Areas: map[string]Area{"backend": area}}}, map[string]rubric.Rubric{"backend.v1": rubricValue})
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"index.json", "stats.json", filepath.Join("rubrics", "backend.v1.json"), filepath.Join("teams", "team-1.json")} {
		if _, err := os.Stat(filepath.Join(root, name)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Stat(filepath.Join(root, "teams", "stale-team.json")); !os.IsNotExist(err) {
		t.Fatalf("stale team bundle was not removed, stat error = %v", err)
	}
	var index map[string]any
	data, err := os.ReadFile(filepath.Join(root, "index.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &index); err != nil {
		t.Fatal(err)
	}
	if index["bundle_schema"] != SchemaVersion || index["built_at"] == nil {
		t.Fatalf("invalid index metadata: %#v", index)
	}
	var team map[string]any
	data, err = os.ReadFile(filepath.Join(root, "teams", "team-1.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &team); err != nil {
		t.Fatal(err)
	}
	teamJSON, _ := json.Marshal(team)
	if strings.Contains(string(teamJSON), "duration_ms") || strings.Contains(string(teamJSON), "link_error") {
		t.Fatalf("internal telemetry leaked into public schema: %s", teamJSON)
	}
	var rubricJSON map[string]any
	data, err = os.ReadFile(filepath.Join(root, "rubrics", "backend.v1.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &rubricJSON); err != nil {
		t.Fatal(err)
	}
	if rubricJSON["schema_version"] != "rubric.v1" || rubricJSON["rubric_version"] != "backend.v1" {
		t.Fatalf("invalid rubric bundle: %#v", rubricJSON)
	}
}
