package pipeline

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

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
	r := rubric.Rubric{ID: "backend.v1", Version: "backend.v1", Area: "backend", Scale: rubric.Scale{Min: 0, Max: 10, Anchors: []int{2, 5, 8, 10}}, Categories: []rubric.Category{{
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
	config := Config{OutputDir: output, WorkspaceDir: t.TempDir(), Registry: registry.Registry{Teams: []registry.Team{{ID: "team-1", Name: "Team 1", Repo: repo, Branch: "main", Active: true, Paths: map[string]string{"backend": "."}}}}, Rubrics: map[string]rubric.Rubric{"backend.v1": r}, Provider: fake, MaxParallel: 1, Templates: enrichmentTemplate(), Now: fixedNow, SkillsDir: skillsFixture(t, "backend", "1.0.0"), RubricPaths: map[string]string{"backend.v1": "../../../rubrics/backend.v1.yaml"}}
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

// Kept local to avoid importing the CLI package in pipeline tests.
func enrichmentTemplate() enrichment.TemplateConfig { return enrichment.TemplateConfig{} }
func fixedNow() time.Time                           { return time.Date(2026, 9, 22, 0, 0, 0, 0, time.UTC) }
