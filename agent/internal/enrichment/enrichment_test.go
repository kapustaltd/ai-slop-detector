package enrichment

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
)

func TestEnrichesValidAndPreservesInvalidFindings(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	report := contract.Report{Metrics: []contract.Metric{{ID: "metric", Findings: []contract.Finding{
		{Kind: "strength", Severity: "info", File: "main.go", LineStart: 1, LineEnd: 3, Title: "valid", Explanation: "valid"},
		{Kind: "issue", Severity: "major", File: "missing.go", LineStart: 1, LineEnd: 1, Title: "missing", Explanation: "missing", Suggestion: "fix"},
		{Kind: "issue", Severity: "major", File: "main.go", LineStart: 1, LineEnd: 99, Title: "range", Explanation: "range", Suggestion: "fix"},
	}}}}
	result := Enrich(report, Options{RepoRoot: root, RepoURL: "https://github.com/acme/repo.git", CommitSHA: strings.Repeat("a", 40), Templates: TemplateConfig{GitHub: "{base}/blob/{sha}/{path}#L{start}-L{end}"}, MaxSnippetLines: 2})
	if result.Metrics[0].Findings[0].LinkStatus != "verified" {
		t.Fatalf("valid finding: %#v", result.Metrics[0].Findings[0])
	}
	if result.Metrics[0].Findings[0].Snippet != "package main\n" {
		t.Fatalf("unexpected clipped snippet: %q", result.Metrics[0].Findings[0].Snippet)
	}
	if result.Metrics[0].Findings[0].Permalink != "https://github.com/acme/repo/blob/"+strings.Repeat("a", 40)+"/main.go#L1-L3" {
		t.Fatalf("unexpected permalink: %s", result.Metrics[0].Findings[0].Permalink)
	}
	if result.Metrics[0].Findings[1].LinkStatus != "missing_file" || result.Metrics[0].Findings[1].Snippet != "" {
		t.Fatalf("missing file was not preserved safely: %#v", result.Metrics[0].Findings[1])
	}
	if result.Metrics[0].Findings[2].LinkStatus != "invalid_range" {
		t.Fatalf("invalid range: %#v", result.Metrics[0].Findings[2])
	}
}

func TestPermalinkIncludesAreaPathFromRepositoryRoot(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "main.go"), []byte("package main\n"), 0600); err != nil {
		t.Fatal(err)
	}
	sha := strings.Repeat("b", 40)
	report := contract.Report{Metrics: []contract.Metric{{
		ID: "metric",
		Findings: []contract.Finding{{
			Kind: "strength", Severity: "info", File: "main.go", LineStart: 1, LineEnd: 1,
			Title: "valid", Explanation: "valid",
		}},
	}}}
	options := Options{
		RepoRoot: root, AreaPath: "backend", RepoURL: "https://github.com/acme/repo",
		CommitSHA: sha, Templates: TemplateConfig{GitHub: "{base}/blob/{sha}/{path}#L{start}-L{end}"},
	}

	result := Enrich(report, options)
	want := "https://github.com/acme/repo/blob/" + sha + "/backend/main.go#L1-L1"
	if got := result.Metrics[0].Findings[0].Permalink; got != want {
		t.Fatalf("permalink = %q, want %q", got, want)
	}

	result.Metrics[0].Findings[0].Permalink = "https://github.com/acme/repo/blob/old/main.go"
	RefreshPermalinks(&result, options)
	if got := result.Metrics[0].Findings[0].Permalink; got != want {
		t.Fatalf("refreshed permalink = %q, want %q", got, want)
	}
}
