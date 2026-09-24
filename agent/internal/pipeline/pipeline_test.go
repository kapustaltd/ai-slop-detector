package pipeline

import (
	"context"
	"encoding/json"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/bundle"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

func TestWritePartialTeamPublishesOnlyCompletedArea(t *testing.T) {
	root := t.TempDir()
	score := 8.0
	result := teamRun{Registry: registry.Team{ID: "alpha", Name: "Alpha"}, CommitSHA: "abc", Areas: map[string]bundle.Area{"backend": {Status: "done", Score: &score}}}
	if err := writePartialTeam(root, time.Date(2026, 9, 24, 0, 0, 0, 0, time.UTC), result); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, "teams", "alpha.json"))
	if err != nil {
		t.Fatal(err)
	}
	var published bundle.Team
	if err := json.Unmarshal(data, &published); err != nil {
		t.Fatal(err)
	}
	if published.Status != "running" || published.Total != nil || !published.Partial || published.Areas["backend"].Status != "done" || len(published.Areas) != 1 {
		t.Fatalf("partial team: %+v", published)
	}
}

// skillsFixture кладёт на диск скилл ревью: пайплайн читает из него skill_version,
// поэтому без файла прогон невозможен (спека 003 FR-013e).
func skillsFixture(t *testing.T, area, version string) string {
	t.Helper()
	dir := t.TempDir()
	skillDir := filepath.Join(dir, "review-"+area)
	if err := os.MkdirAll(skillDir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := "---\nname: review-" + area + "\nmetadata:\n  skill_version: \"" + version + "\"\n---\n\n# Review\n"
	if err := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	return dir
}

func TestRunRetriesInvalidOutputAndResumesWithoutProvider(t *testing.T) {
	repo := t.TempDir()
	if err := os.WriteFile(filepath.Join(repo, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"init", "-q", "-b", "main"}, {"config", "user.email", "test@example.invalid"}, {"config", "user.name", "Test"}, {"add", "."}, {"commit", "-qm", "fixture"}} {
		command := exec.Command("git", args...)
		command.Dir = repo
		if output, err := command.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, output)
		}
	}
	shaBytes, err := exec.Command("git", "-C", repo, "rev-parse", "main").Output()
	if err != nil {
		t.Fatal(err)
	}
	sha := strings.TrimSpace(string(shaBytes))
	repoURL := (&url.URL{Scheme: "file", Path: repo}).String()
	r := rubric.Rubric{SchemaVersion: "rubric.v1", RubricVersion: "backend.v1", AreaWeights: map[string]float64{"backend": .5, "frontend": .5}, ID: "backend.v1", Version: "backend.v1", Area: "backend", Scale: rubric.Scale{Min: 0, Max: 10, Anchors: []int{2, 5, 8, 10}}, Categories: []rubric.Category{{
		ID: "cat", Name: "Category", Weight: 1,
		Subcategories: []rubric.Subcategory{{
			ID: "sub", Name: "Sub", Weight: 1,
			Metrics: []rubric.Metric{{ID: "metric", Name: "Metric", Description: "Metric", Weight: 1, Anchors: rubric.MetricAnchors{Level2: "2", Level5: "5", Level8: "8", Level10: "10"}}},
		}},
	}}}
	valid, err := json.Marshal(map[string]any{
		"meta":            map[string]any{"schema_version": "evaluation.v1", "team_id": "team-1", "area": "backend", "repo": "team-1", "commit_sha": sha, "skill_version": "1.0.0", "rubric_version": "backend.v1", "model": "test-model", "evaluated_at": "2026-09-22T00:00:00Z"},
		"metrics":         []any{map[string]any{"id": "metric", "score": 8, "max": 10, "confidence": "high", "summary": "good", "rationale": "good", "findings": []any{map[string]any{"kind": "strength", "severity": "info", "file": "main.go", "line_start": 1, "line_end": 3, "title": "source", "explanation": "source"}}}},
		"overall_comment": "review", "warnings": []string{},
	})
	if err != nil {
		t.Fatal(err)
	}
	fake := &provider.JSONProvider{Responses: [][]byte{[]byte("not-json"), valid}}
	output := t.TempDir()
	skillsDir := skillsFixture(t, "backend", "1.0.0")
	config := Config{OutputDir: output, WorkspaceDir: t.TempDir(), Registry: registry.Registry{Teams: []registry.Team{{ID: "team-1", Name: "Team 1", Repo: repoURL, Branch: "main", Active: true, Paths: map[string]string{"backend": "."}}}}, Rubrics: map[string]rubric.Rubric{"backend.v1": r}, Provider: fake, MaxParallel: 1, Templates: enrichmentTemplate(), Now: fixedNow, SkillsDir: skillsDir, RubricPaths: map[string]string{"backend.v1": "../../../rubrics/backend.v1.yaml"}}
	config.Model = "test-model"
	summary, err := (Pipeline{}).Run(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	if summary.TeamsDone != 1 || summary.AreasDone != 1 || summary.AreasFailed != 0 {
		t.Fatalf("unexpected summary: %#v", summary)
	}
	if _, err := os.Stat(filepath.Join(output, "raw", summary.RunID, "team-1", "backend", "attempt-01.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(output, "raw", summary.RunID, "team-1", "backend", "attempt-02.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(output, "index.json")); err != nil {
		t.Fatal(err)
	}
	if fake.Index != 2 {
		t.Fatalf("provider attempts = %d", fake.Index)
	}

	second := &provider.JSONProvider{}
	config.Provider = second
	secondSummary, err := (Pipeline{}).Run(context.Background(), config)
	if err != nil {
		t.Fatal(err)
	}
	if secondSummary.TeamsDone != 1 || secondSummary.AreasFailed != 0 || second.Index != 0 {
		t.Fatalf("completed state was not resumed: %#v calls=%d", secondSummary, second.Index)
	}

	// Every case starts from the same valid cached state and keeps the repo SHA.
	statePath := filepath.Join(output, "state", "team-1", "backend.json")
	baseline, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name   string
		change func(*Config, *savedEvaluation)
	}{
		{"skill", func(c *Config, _ *savedEvaluation) {
			path := filepath.Join(c.SkillsDir, "review-backend", "SKILL.md")
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(path, []byte(strings.Replace(string(data), `skill_version: "1.0.0"`, `skill_version: "1.1.0"`, 1)), 0o600); err != nil {
				t.Fatal(err)
			}
		}},
		{"model", func(c *Config, _ *savedEvaluation) { c.Model = "another-model" }},
		{"rubric content", func(c *Config, _ *savedEvaluation) {
			var copy rubric.Rubric
			raw, _ := json.Marshal(r)
			if err := json.Unmarshal(raw, &copy); err != nil {
				t.Fatal(err)
			}
			copy.Version = r.Version
			copy.Categories[0].Subcategories[0].Metrics[0].Description = "changed anchor interpretation"
			c.Rubrics = map[string]rubric.Rubric{"backend.v1": copy}
		}},
		{"scanner limits", func(c *Config, _ *savedEvaluation) { c.ScannerConfig.MaxFiles = 5 }},
		{"legacy cache", func(_ *Config, s *savedEvaluation) { s.InputDigest = "" }},
		{"corrupt score", func(_ *Config, s *savedEvaluation) { s.Report.Metrics[0].Score = 11 }},
		{"corrupt skill metadata", func(_ *Config, s *savedEvaluation) { s.Report.Meta.SkillVersion = "9.0.0" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := config
			c.SkillsDir = skillsFixture(t, "backend", "1.0.0")
			var saved savedEvaluation
			if err := json.Unmarshal(baseline, &saved); err != nil {
				t.Fatal(err)
			}
			tc.change(&c, &saved)
			if err := writeJSON(statePath, saved); err != nil {
				t.Fatal(err)
			}
			p := &provider.JSONProvider{Responses: [][]byte{valid}}
			c.Provider = p
			if _, err := (Pipeline{}).Run(context.Background(), c); err != nil {
				t.Fatal(err)
			}
			if p.Index == 0 {
				t.Fatal("stale cache bypassed provider")
			}
		})
	}
	if err := os.WriteFile(statePath, baseline, 0600); err != nil {
		t.Fatal(err)
	}
	config.Recalculate = true
	config.Provider = nil
	if _, err := (Pipeline{}).Run(context.Background(), config); err != nil {
		t.Fatal(err)
	}
	before, err := os.ReadFile(filepath.Join(output, "index.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"skill", "model", "rubric", "missing score"} {
		t.Run("recalculate/"+kind, func(t *testing.T) {
			c := config
			if err := os.WriteFile(statePath, baseline, 0600); err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "skill":
				path := filepath.Join(c.SkillsDir, "review-backend", "SKILL.md")
				data, err := os.ReadFile(path)
				if err != nil {
					t.Fatal(err)
				}
				updated := strings.Replace(string(data), `skill_version: "1.0.0"`, `skill_version: "2.0.0"`, 1)
				if err := os.WriteFile(path, []byte(updated), 0o600); err != nil {
					t.Fatal(err)
				}
			case "model":
				c.Model = "changed-model"
			case "rubric":
				var saved savedEvaluation
				if err := json.Unmarshal(baseline, &saved); err != nil {
					t.Fatal(err)
				}
				saved.RubricDigest = "stale"
				if err := writeJSON(statePath, saved); err != nil {
					t.Fatal(err)
				}
			case "missing score":
				var saved map[string]any
				if err := json.Unmarshal(baseline, &saved); err != nil {
					t.Fatal(err)
				}
				delete(saved["report"].(map[string]any)["metrics"].([]any)[0].(map[string]any), "score")
				if err := writeJSON(statePath, saved); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := (Pipeline{}).Run(context.Background(), c); err == nil {
				t.Fatal("recalculate accepted incompatible state")
			}
			after, err := os.ReadFile(filepath.Join(output, "index.json"))
			if err != nil {
				t.Fatal(err)
			}
			if string(before) != string(after) {
				t.Fatal("failed recalculate changed published index")
			}
		})
	}
}

func TestOutputLockPreventsConcurrentRuns(t *testing.T) {
	output := t.TempDir()
	release, err := acquireLock(output)
	if err != nil {
		t.Fatal(err)
	}
	defer release()
	if _, err := acquireLock(output); err == nil {
		t.Fatal("expected second pipeline to be rejected")
	}
}

func TestConfigRejectsIncompatibleRubricsBeforeProvider(t *testing.T) {
	for _, kind := range []string{"invalid keys", "mismatched weights", "mismatched version"} {
		t.Run(kind, func(t *testing.T) {
			backend, err := rubric.Load("../../../rubrics/backend.v1.yaml")
			if err != nil {
				t.Fatal(err)
			}
			frontend, err := rubric.Load("../../../rubrics/frontend.v1.yaml")
			if err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "invalid keys":
				backend.AreaWeights = map[string]float64{"wrong_a": .5, "wrong_b": .5}
			case "mismatched weights":
				frontend.AreaWeights = map[string]float64{"backend": .6, "frontend": .4}
			case "mismatched version":
				backend.Version = "backend.v2"
			}
			p := &provider.JSONProvider{Responses: [][]byte{[]byte("unexpected call")}}
			config := Config{OutputDir: filepath.Join(t.TempDir(), "output"), WorkspaceDir: t.TempDir(), Registry: registry.Registry{Teams: []registry.Team{{ID: "team-1", Name: "Team", Repo: "https://github.com/example/never-clone", Branch: "main", Active: true}}}, Provider: p, Rubrics: map[string]rubric.Rubric{"backend.v1": backend, "frontend.v1": frontend}}
			if _, err := (Pipeline{}).Run(context.Background(), config); err == nil || !strings.Contains(err.Error(), "rubric") {
				t.Fatalf("expected rubric preflight error, got %v", err)
			}
			if p.Index != 0 {
				t.Fatal("invalid rubric reached provider")
			}
			if _, err := os.Stat(config.OutputDir); !os.IsNotExist(err) {
				t.Fatalf("preflight created output: %v", err)
			}
		})
	}
}

func TestTeamTotalUsesRubricWeights(t *testing.T) {
	backend, frontend := 10.0, 0.0
	rubrics := map[string]rubric.Rubric{}
	for _, area := range []string{"backend", "frontend"} {
		rubrics[area+".v1"] = rubric.Rubric{Scale: rubric.Scale{Max: 10}, AreaWeights: map[string]float64{"backend": .8, "frontend": .2}}
	}
	areas := map[string]bundle.Area{"backend": {Status: "done", Score: &backend}, "frontend": {Status: "done", Score: &frontend}}
	if score, ok := teamTotal(areas, rubrics, registry.Team{}); !ok || score != 8 {
		t.Fatalf("weighted total = %v, %v", score, ok)
	}
	delete(areas, "frontend")
	if score, ok := teamTotal(areas, rubrics, registry.Team{}); !ok || score != 10 {
		t.Fatalf("partial total = %v, %v", score, ok)
	}
}

// Kept local to avoid importing the CLI package in pipeline tests.
func enrichmentTemplate() enrichment.TemplateConfig { return enrichment.TemplateConfig{} }
func fixedNow() time.Time                           { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
