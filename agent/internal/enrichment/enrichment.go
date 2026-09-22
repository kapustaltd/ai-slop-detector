package enrichment

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/scanner"
)

const (
	DefaultMaxSnippetLines = 80
	DefaultMaxSnippetBytes = 12 * 1024
)

type TemplateConfig struct {
	GitHub   string `yaml:"github" json:"github"`
	GitLab   string `yaml:"gitlab" json:"gitlab"`
	GitVerse string `yaml:"gitverse" json:"gitverse"`
}

type EnrichedFinding struct {
	contract.Finding
	LinkStatus string `json:"link_status"`
	LinkError  string `json:"-"`
	Snippet    string `json:"snippet,omitempty"`
	Permalink  string `json:"permalink,omitempty"`
}

type Result struct {
	Metrics  []Metric `json:"metrics"`
	Warnings []string `json:"warnings"`
}

type Metric struct {
	ID         string            `json:"id"`
	Score      float64           `json:"score"`
	Max        float64           `json:"max"`
	Confidence string            `json:"confidence"`
	Summary    string            `json:"summary"`
	Rationale  string            `json:"rationale"`
	Findings   []EnrichedFinding `json:"findings"`
}

type Options struct {
	RepoRoot        string
	RepoURL         string
	CommitSHA       string
	Templates       TemplateConfig
	MaxSnippetLines int
	MaxSnippetBytes int
}

func Enrich(report contract.Report, options Options) Result {
	maxLines := options.MaxSnippetLines
	if maxLines <= 0 {
		maxLines = DefaultMaxSnippetLines
	}
	maxBytes := options.MaxSnippetBytes
	if maxBytes <= 0 {
		maxBytes = DefaultMaxSnippetBytes
	}
	result := Result{Warnings: append([]string(nil), report.Warnings...)}
	for _, metric := range report.Metrics {
		item := Metric{
			ID: metric.ID, Score: metric.Score, Max: metric.Max,
			Confidence: metric.Confidence, Summary: metric.Summary, Rationale: metric.Rationale,
			Findings: make([]EnrichedFinding, 0, len(metric.Findings)),
		}
		for _, finding := range metric.Findings {
			item.Findings = append(item.Findings, enrichFinding(finding, options, maxLines, maxBytes))
		}
		result.Metrics = append(result.Metrics, item)
	}
	return result
}

func enrichFinding(finding contract.Finding, options Options, maxLines, maxBytes int) EnrichedFinding {
	result := EnrichedFinding{Finding: finding, LinkStatus: "unverified"}
	if filepath.IsAbs(finding.File) || filepath.Clean(finding.File) != finding.File || finding.File == ".." || strings.HasPrefix(finding.File, "../") || strings.Contains(finding.File, `\`) {
		result.LinkStatus = "unsafe_path"
		result.LinkError = "finding path is outside the repository"
		return result
	}
	path := filepath.Join(options.RepoRoot, filepath.FromSlash(finding.File))
	root, err := filepath.Abs(options.RepoRoot)
	if err != nil {
		result.LinkStatus = "unverified"
		result.LinkError = err.Error()
		return result
	}
	absolute, err := filepath.Abs(path)
	if err != nil || (absolute != root && !strings.HasPrefix(absolute, root+string(filepath.Separator))) {
		result.LinkStatus = "unsafe_path"
		result.LinkError = "finding path is outside the repository"
		return result
	}
	if scanner.IsSensitivePath(finding.File) {
		result.LinkStatus = "unverified"
		result.LinkError = "sensitive files are not published in snippets"
		return result
	}
	fileInfo, err := os.Lstat(absolute)
	if err != nil {
		if os.IsNotExist(err) {
			result.LinkStatus = "missing_file"
		} else {
			result.LinkStatus = "unverified"
		}
		result.LinkError = "file cannot be read from the pinned snapshot"
		return result
	}
	if fileInfo.Mode()&os.ModeSymlink != 0 {
		result.LinkStatus = "unsafe_path"
		result.LinkError = "symbolic links are not part of the pinned snapshot"
		return result
	}
	data, err := os.ReadFile(absolute)
	if err != nil {
		if os.IsNotExist(err) {
			result.LinkStatus = "missing_file"
		} else {
			result.LinkStatus = "unverified"
		}
		result.LinkError = "file cannot be read from the pinned snapshot"
		return result
	}
	lines := splitLines(string(data))
	if finding.LineStart < 1 || finding.LineEnd < finding.LineStart || finding.LineStart > len(lines) || finding.LineEnd > len(lines) {
		result.LinkStatus = "invalid_range"
		result.LinkError = fmt.Sprintf("line range %d-%d is outside file with %d lines", finding.LineStart, finding.LineEnd, len(lines))
		return result
	}
	end := finding.LineEnd
	if end-finding.LineStart+1 > maxLines {
		end = finding.LineStart + maxLines - 1
	}
	snippet := string(scanner.RedactContent([]byte(strings.Join(lines[finding.LineStart-1:end], "\n"))))
	if len(snippet) > maxBytes {
		snippet = snippet[:maxBytes]
	}
	result.Snippet = snippet
	result.LinkStatus = "verified"
	result.Permalink = makePermalink(options.RepoURL, options.CommitSHA, finding.File, finding.LineStart, finding.LineEnd, options.Templates)
	if result.Permalink == "" {
		result.LinkStatus = "unverified"
		result.LinkError = "no permalink template configured for repository host"
	}
	return result
}

func makePermalink(repoURL, sha, path string, start, end int, templates TemplateConfig) string {
	template := templateFor(repoURL, templates)
	if template == "" {
		return ""
	}
	base := strings.TrimSuffix(strings.TrimSuffix(repoURL, "/"), ".git")
	return strings.NewReplacer(
		"{base}", base,
		"{sha}", sha,
		"{path}", escapePath(path),
		"{start}", fmt.Sprintf("%d", start),
		"{end}", fmt.Sprintf("%d", end),
	).Replace(template)
}

func escapePath(value string) string {
	parts := strings.Split(value, "/")
	for index, part := range parts {
		parts[index] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func templateFor(repoURL string, templates TemplateConfig) string {
	parsed, err := url.Parse(repoURL)
	if err != nil {
		return ""
	}
	host := strings.ToLower(parsed.Hostname())
	switch {
	case host == "github.com" || strings.HasSuffix(host, ".github.com"):
		return templates.GitHub
	case host == "gitlab.com" || strings.HasSuffix(host, ".gitlab.com"):
		return templates.GitLab
	case host == "gitverse.ru" || strings.HasSuffix(host, ".gitverse.ru"):
		return templates.GitVerse
	default:
		return ""
	}
}

func splitLines(value string) []string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.TrimSuffix(value, "\n")
	if value == "" {
		return nil
	}
	return strings.Split(value, "\n")
}
