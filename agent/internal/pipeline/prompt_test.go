package pipeline

import (
	"strings"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/scanner"
)

func TestPromptContainsRubricAndReportContract(t *testing.T) {
	value, err := rubric.Load("../../../rubrics/backend.v1.yaml")
	if err != nil {
		t.Fatal(err)
	}
	prompt := buildPrompt(registry.Team{ID: "123"}, "backend", strings.Repeat("a", 40), value, scanner.Snapshot{}, "test-model", "1.0.0")
	for _, expected := range []string{`"repo":"123"`, `"model":"test-model"`, `"schema_version":"evaluation.v1"`, `"rubric_version":"backend.v1"`, "overall_comment", "line_start", "info/minor/major/critical"} {
		if !strings.Contains(prompt, expected) {
			t.Errorf("prompt lacks %s", expected)
		}
	}
	for _, category := range value.Categories {
		for _, subcategory := range category.Subcategories {
			for _, metric := range subcategory.Metrics {
				if !strings.Contains(prompt, `"id":"`+metric.ID+`"`) {
					t.Errorf("prompt lacks metric %s", metric.ID)
				}
			}
		}
	}
}
