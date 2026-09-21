package contract

import (
	"os"
	"path/filepath"
	"testing"
)

func validReport() Report {
	return Report{
		Meta: Meta{
			SchemaVersion: "evaluation.v1",
			TeamID:        "team-1",
			Area:          "backend",
			Repo:          "repo-1",
			CommitSHA:     "0123456789012345678901234567890123456789",
			SkillVersion:  "1.0.0",
			RubricVersion: "backend.v1",
			Model:         "test-model",
			EvaluatedAt:   "2026-09-22T00:00:00Z",
		},
		Metrics: []Metric{{
			ID:         "metric_a",
			Score:      8,
			Max:        10,
			Confidence: "high",
			Summary:    "clear boundary",
			Rationale:  "the boundary is visible in the source",
			Findings: []Finding{{
				Kind:        "strength",
				Severity:    "info",
				File:        "main.go",
				LineStart:   1,
				LineEnd:     1,
				Title:       "Boundary",
				Explanation: "The package has an explicit entry point.",
			}},
		}},
		OverallComment: "useful report",
	}
}

func contextForReport() ValidationContext {
	return ValidationContext{
		ExpectedArea:    "backend",
		ExpectedRepoID:  "repo-1",
		ExpectedTeamID:  "team-1",
		ExpectedSHA:     "0123456789012345678901234567890123456789",
		ExpectedRubric:  "backend.v1",
		ExpectedModel:   "test-model",
		ExpectedMetrics: map[string]struct{}{"metric_a": {}},
		LineCounts:      map[string]int{"main.go": 1},
	}
}

func TestValidateAcceptsReport(t *testing.T) {
	if err := Validate(validReport(), contextForReport()); err != nil {
		t.Fatal(err)
	}
}

func TestValidateRejectsInvalidReports(t *testing.T) {
	tests := []struct {
		name   string
		modify func(*Report)
	}{
		{"score above max", func(report *Report) { report.Metrics[0].Score = 11 }},
		{"missing finding", func(report *Report) { report.Metrics[0].Findings = nil }},
		{"unsafe path", func(report *Report) { report.Metrics[0].Findings[0].File = "../secret.go" }},
		{"unknown file", func(report *Report) { report.Metrics[0].Findings[0].File = "other.go" }},
		{"issue without suggestion", func(report *Report) {
			report.Metrics[0].Findings[0].Kind = "issue"
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			report := validReport()
			test.modify(&report)
			if err := Validate(report, contextForReport()); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func TestLoadMetricIDs(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rubric.yaml")
	content := "categories:\n  - id: architecture\n    subcategories:\n      - id: boundaries\n        metrics:\n          - id: layer_separation\n          - id: module_boundaries\n"
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	ids, err := LoadMetricIDs(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(ids) != 2 {
		t.Fatalf("metric IDs = %#v", ids)
	}
}
