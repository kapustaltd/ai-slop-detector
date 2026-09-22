package agent

import (
	"context"
	"strings"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/scanner"
)

type fakeProvider struct {
	responses []string
	calls     int
}

func (provider *fakeProvider) Complete(_ context.Context, _, userPrompt string) (string, error) {
	provider.calls++
	if provider.calls > 1 && !strings.Contains(userPrompt, "failed local validation") {
		return provider.responses[len(provider.responses)-1], nil
	}
	return provider.responses[provider.calls-1], nil
}

func TestRunRetriesInvalidReportAndReturnsValidatedReport(t *testing.T) {
	valid := `{"meta":{"schema_version":"evaluation.v1","team_id":"team-1","area":"backend","repo":"repo-1","commit_sha":"0123456789012345678901234567890123456789","skill_version":"1.0.0","rubric_version":"backend.v1","model":"test-model","evaluated_at":"2026-09-22T00:00:00Z"},"metrics":[{"id":"metric_a","score":8,"max":10,"confidence":"high","summary":"clear","rationale":"supported","findings":[{"kind":"strength","severity":"info","file":"main.go","line_start":1,"line_end":1,"title":"Good","explanation":"The boundary is clear."}]}],"overall_comment":"ok","warnings":[]}`
	provider := &fakeProvider{responses: []string{
		`{"meta":{}}`,
		valid,
	}}
	result, err := Run(context.Background(), provider, Input{
		RepoID:        "repo-1",
		TeamID:        "team-1",
		Area:          "backend",
		CommitSHA:     "0123456789012345678901234567890123456789",
		Model:         "test-model",
		RubricVersion: "backend.v1",
		MetricIDs:     map[string]struct{}{"metric_a": {}},
		Snapshot: scanner.Snapshot{
			LineCounts: map[string]int{"main.go": 1},
		},
	}, 2)
	if err != nil {
		t.Fatal(err)
	}
	if result.Attempts != 2 || provider.calls != 2 {
		t.Fatalf("attempts=%d calls=%d", result.Attempts, provider.calls)
	}
	if result.Report.Metrics[0].ID != "metric_a" {
		t.Fatalf("unexpected report: %#v", result.Report)
	}
}
