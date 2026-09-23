package contract

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
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
		Warnings:       []string{},
	}
}

func TestDecodeRequiredAndNullFields(t *testing.T) {
	tests := []struct {
		path         string
		selectObject func(map[string]any) (map[string]any, string)
	}{
		{"$.meta", func(v map[string]any) (map[string]any, string) { return v, "meta" }},
		{"$.warnings", func(v map[string]any) (map[string]any, string) { return v, "warnings" }},
		{"$.metrics", func(v map[string]any) (map[string]any, string) { return v, "metrics" }},
		{"$.meta.model", func(v map[string]any) (map[string]any, string) { return v["meta"].(map[string]any), "model" }},
		{"$.metrics[0].score", func(v map[string]any) (map[string]any, string) {
			return v["metrics"].([]any)[0].(map[string]any), "score"
		}},
		{"$.metrics[0].findings[0].line_start", func(v map[string]any) (map[string]any, string) {
			return v["metrics"].([]any)[0].(map[string]any)["findings"].([]any)[0].(map[string]any), "line_start"
		}},
	}
	for _, tc := range tests {
		for _, null := range []bool{false, true} {
			t.Run(tc.path+map[bool]string{false: "/absent", true: "/null"}[null], func(t *testing.T) {
				raw, err := json.Marshal(validReport())
				if err != nil {
					t.Fatal(err)
				}
				var value map[string]any
				if err := json.Unmarshal(raw, &value); err != nil {
					t.Fatal(err)
				}
				object, key := tc.selectObject(value)
				if null {
					object[key] = nil
				} else {
					delete(object, key)
				}
				raw, err = json.Marshal(value)
				if err != nil {
					t.Fatal(err)
				}
				if _, err := DecodeReport(raw); err == nil || !strings.Contains(err.Error(), tc.path) {
					t.Fatalf("want error at %s, got %v", tc.path, err)
				}
			})
		}
	}
}

func TestDecodeAcceptsExplicitZeroAndEmptyWarnings(t *testing.T) {
	report := validReport()
	report.Metrics[0].Score = 0
	raw, err := EncodeReport(report)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := DecodeReport(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := Validate(decoded, contextForReport()); err != nil {
		t.Fatal(err)
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

// The frontend contract gate validates this same corpus through JSON Schema.
func TestSharedContractFixtures(t *testing.T) {
	for _, kind := range []string{"valid", "invalid"} {
		files, err := filepath.Glob(filepath.Join("../../../fixtures/evaluation", kind, "*.json"))
		if err != nil || len(files) == 0 {
			t.Fatalf("fixtures %s: %v", kind, err)
		}
		for _, file := range files {
			t.Run(kind+"/"+filepath.Base(file), func(t *testing.T) {
				raw, err := os.ReadFile(file)
				if err != nil {
					t.Fatal(err)
				}
				report, validationErr := DecodeReport(raw)
				if validationErr == nil {
					ids, err := LoadMetricIDs(filepath.Join("../../../rubrics", report.Meta.Area+".v1.yaml"))
					if err != nil {
						t.Fatal(err)
					}
					validationErr = Validate(report, ValidationContext{ExpectedArea: report.Meta.Area, ExpectedRepoID: report.Meta.Repo, ExpectedTeamID: report.Meta.TeamID, ExpectedSHA: report.Meta.CommitSHA, ExpectedRubric: report.Meta.Area + ".v1", ExpectedMetrics: ids})
				}
				if kind == "valid" && validationErr != nil {
					t.Fatal(validationErr)
				}
				if kind == "invalid" && validationErr == nil {
					t.Fatal("invalid shared fixture accepted")
				}
			})
		}
	}
}
