package contract

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"
)

var fullSHA = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)
var semanticVersion = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
var safeTeamID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

const (
	maxTextLength  = 16 * 1024
	maxFindings    = 20
	maxWarningSize = 64
)

var allowedWarnings = map[string]struct{}{
	"incomplete_area":            {},
	"file_limit_exceeded":        {},
	"provider_error":             {},
	"repo_too_large":             {},
	"secret_redacted":            {},
	"suspected_prompt_injection": {},
}

// These aliases keep the runtime validator's concise names while making the
// generated contract types the single source of truth for JSON structures.
type Report = EvaluationReport
type Meta = ReportMeta
type Metric = MetricScore

func DecodeReport(raw []byte) (Report, error) {
	cleaned := stripMarkdownFence(bytes.TrimSpace(raw))
	start := bytes.IndexByte(cleaned, '{')
	end := bytes.LastIndexByte(cleaned, '}')
	if start < 0 || end < start {
		return Report{}, errors.New("provider response does not contain a JSON object")
	}

	var report Report
	if err := validateJSONPresence(cleaned[start:end+1], reflect.TypeOf(report), "$", true); err != nil {
		return Report{}, err
	}
	decoder := json.NewDecoder(bytes.NewReader(cleaned[start : end+1]))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&report); err != nil {
		return Report{}, fmt.Errorf("decode report JSON: %w", err)
	}
	return report, nil
}

// Required fields are derived from the schema-generated JSON tags. Inspect the
// raw JSON before decoding: absent numbers otherwise become indistinguishable
// from an explicitly supplied zero, and null is silently accepted by encoding/json.
func validateJSONPresence(raw json.RawMessage, typ reflect.Type, path string, required bool) error {
	if len(raw) == 0 {
		if required {
			return fmt.Errorf("%s is required", path)
		}
		return nil
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return fmt.Errorf("%s must not be null", path)
	}
	switch typ.Kind() {
	case reflect.Struct:
		var object map[string]json.RawMessage
		if err := json.Unmarshal(raw, &object); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		for i := 0; i < typ.NumField(); i++ {
			field := typ.Field(i)
			name, options, _ := strings.Cut(field.Tag.Get("json"), ",")
			if name == "" || name == "-" {
				continue
			}
			if err := validateJSONPresence(object[name], field.Type, path+"."+name, options != "omitempty"); err != nil {
				return err
			}
		}
	case reflect.Slice:
		var items []json.RawMessage
		if err := json.Unmarshal(raw, &items); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		for i, item := range items {
			if err := validateJSONPresence(item, typ.Elem(), fmt.Sprintf("%s[%d]", path, i), true); err != nil {
				return err
			}
		}
	}
	return nil
}

func EncodeReport(report Report) ([]byte, error) {
	return json.MarshalIndent(report, "", "  ")
}

type ValidationContext struct {
	ExpectedArea    string
	ExpectedRepoID  string
	ExpectedTeamID  string
	ExpectedSHA     string
	ExpectedRubric  string
	ExpectedModel   string
	ExpectedMetrics map[string]struct{}
	LineCounts      map[string]int
}

func Validate(report Report, context ValidationContext) error {
	if report.Meta.SchemaVersion != "evaluation.v1" {
		return fmt.Errorf("meta.schema_version must be evaluation.v1, got %q", report.Meta.SchemaVersion)
	}
	if !safeTeamID.MatchString(report.Meta.TeamID) || (context.ExpectedTeamID != "" && report.Meta.TeamID != context.ExpectedTeamID) {
		return fmt.Errorf("meta.team_id has invalid format %q", report.Meta.TeamID)
	}
	if report.Meta.Area != context.ExpectedArea {
		return fmt.Errorf("meta.area must be %q, got %q", context.ExpectedArea, report.Meta.Area)
	}
	if report.Meta.Repo != context.ExpectedRepoID {
		return fmt.Errorf("meta.repo must be %q, got %q", context.ExpectedRepoID, report.Meta.Repo)
	}
	if !fullSHA.MatchString(report.Meta.CommitSHA) || report.Meta.CommitSHA != context.ExpectedSHA {
		return fmt.Errorf("meta.commit_sha must match the full repository SHA %q", context.ExpectedSHA)
	}
	if report.Meta.RubricVersion != context.ExpectedRubric {
		return fmt.Errorf("meta.rubric_version must be %q, got %q", context.ExpectedRubric, report.Meta.RubricVersion)
	}
	if context.ExpectedModel != "" && report.Meta.Model != context.ExpectedModel {
		return fmt.Errorf("meta.model must be %q, got %q", context.ExpectedModel, report.Meta.Model)
	}
	for name, value := range map[string]string{
		"meta.skill_version":  report.Meta.SkillVersion,
		"meta.rubric_version": report.Meta.RubricVersion,
		"meta.model":          report.Meta.Model,
		"meta.evaluated_at":   report.Meta.EvaluatedAt,
	} {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required", name)
		}
	}
	if !semanticVersion.MatchString(report.Meta.SkillVersion) {
		return fmt.Errorf("meta.skill_version must use semantic version format, got %q", report.Meta.SkillVersion)
	}
	if _, err := time.Parse(time.RFC3339, report.Meta.EvaluatedAt); err != nil {
		return fmt.Errorf("meta.evaluated_at must be RFC3339: %w", err)
	}
	if strings.TrimSpace(report.OverallComment) == "" {
		return errors.New("overall_comment is required")
	}
	if len(report.Metrics) == 0 {
		return errors.New("metrics must not be empty")
	}

	seen := make(map[string]struct{}, len(report.Metrics))
	for index, metric := range report.Metrics {
		if metric.ID == "" {
			return fmt.Errorf("metrics[%d].id is required", index)
		}
		if _, exists := seen[metric.ID]; exists {
			return fmt.Errorf("metric %q appears more than once", metric.ID)
		}
		seen[metric.ID] = struct{}{}
		if _, expected := context.ExpectedMetrics[metric.ID]; !expected {
			return fmt.Errorf("metric %q is not present in the rubric", metric.ID)
		}
		if metric.Max != 10 || metric.Score < 0 || metric.Score > metric.Max {
			return fmt.Errorf("metric %q has invalid score %.2f/%0.2f", metric.ID, metric.Score, metric.Max)
		}
		if metric.Confidence != "high" && metric.Confidence != "medium" && metric.Confidence != "low" {
			return fmt.Errorf("metric %q has invalid confidence %q", metric.ID, metric.Confidence)
		}
		if strings.TrimSpace(metric.Summary) == "" || strings.TrimSpace(metric.Rationale) == "" {
			return fmt.Errorf("metric %q requires summary and rationale", metric.ID)
		}
		if len(metric.Summary) > maxTextLength || len(metric.Rationale) > maxTextLength {
			return fmt.Errorf("metric %q contains text longer than %d characters", metric.ID, maxTextLength)
		}
		if len(metric.Findings) == 0 {
			return fmt.Errorf("metric %q requires at least one finding", metric.ID)
		}
		if len(metric.Findings) > maxFindings {
			return fmt.Errorf("metric %q contains more than %d findings", metric.ID, maxFindings)
		}
		for findingIndex, finding := range metric.Findings {
			if err := validateFinding(metric.ID, findingIndex, finding, context.LineCounts); err != nil {
				return err
			}
		}
	}
	if len(seen) != len(context.ExpectedMetrics) {
		missing := make([]string, 0)
		for id := range context.ExpectedMetrics {
			if _, exists := seen[id]; !exists {
				missing = append(missing, id)
			}
		}
		sort.Strings(missing)
		return fmt.Errorf("report is missing rubric metrics: %s", strings.Join(missing, ", "))
	}
	for _, warning := range report.Warnings {
		if len(warning) > maxWarningSize {
			return fmt.Errorf("warning %q is too long", warning)
		}
		if _, allowed := allowedWarnings[warning]; !allowed {
			return fmt.Errorf("unknown warning %q", warning)
		}
	}
	return nil
}

func validateFinding(metricID string, index int, finding Finding, lineCounts map[string]int) error {
	if finding.Kind != "strength" && finding.Kind != "issue" {
		return fmt.Errorf("metric %q finding %d has invalid kind %q", metricID, index, finding.Kind)
	}
	switch finding.Severity {
	case "info", "minor", "major", "critical":
	default:
		return fmt.Errorf("metric %q finding %d has invalid severity %q", metricID, index, finding.Severity)
	}
	if finding.File == "" || filepath.IsAbs(finding.File) || filepath.Clean(finding.File) != finding.File || strings.HasPrefix(finding.File, "../") || finding.File == ".." || strings.Contains(finding.File, `\`) {
		return fmt.Errorf("metric %q finding %d has unsafe relative file path %q", metricID, index, finding.File)
	}
	if finding.LineStart < 1 || finding.LineEnd < finding.LineStart {
		return fmt.Errorf("metric %q finding %d has invalid line range %d-%d", metricID, index, finding.LineStart, finding.LineEnd)
	}
	if lineCounts != nil {
		lineCount, exists := lineCounts[finding.File]
		if !exists {
			return fmt.Errorf("metric %q finding %d references unknown file %q", metricID, index, finding.File)
		}
		if finding.LineEnd > lineCount {
			return fmt.Errorf("metric %q finding %d has invalid line range %d-%d for %q with %d lines", metricID, index, finding.LineStart, finding.LineEnd, finding.File, lineCount)
		}
	}
	if strings.TrimSpace(finding.Title) == "" || strings.TrimSpace(finding.Explanation) == "" {
		return fmt.Errorf("metric %q finding %d requires title and explanation", metricID, index)
	}
	if len(finding.Title) > maxTextLength || len(finding.Explanation) > maxTextLength || len(finding.Suggestion) > maxTextLength {
		return fmt.Errorf("metric %q finding %d contains text longer than %d characters", metricID, index, maxTextLength)
	}
	if finding.Kind == "issue" && strings.TrimSpace(finding.Suggestion) == "" {
		return fmt.Errorf("metric %q finding %d requires suggestion for an issue", metricID, index)
	}
	return nil
}

func LoadMetricIDs(path string) (map[string]struct{}, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open rubric %s: %w", path, err)
	}
	defer file.Close()

	metricsIndent := -1
	ids := make(map[string]struct{})
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)
		if trimmed == "metrics:" {
			metricsIndent = len(line) - len(strings.TrimLeft(line, " \t"))
			continue
		}
		indent := len(line) - len(strings.TrimLeft(line, " \t"))
		if metricsIndent >= 0 && indent <= metricsIndent && trimmed != "" {
			metricsIndent = -1
		}
		if metricsIndent < 0 {
			continue
		}
		idIndex := strings.Index(trimmed, "id:")
		if idIndex < 0 {
			continue
		}
		value := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(trimmed[idIndex+len("id:"):]), "-"))
		if comma := strings.IndexByte(value, ','); comma >= 0 {
			value = value[:comma]
		}
		value = strings.TrimSpace(strings.Trim(value, "{}"))
		value = strings.Trim(value, "\"'")
		if value != "" {
			ids[value] = struct{}{}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read rubric %s: %w", path, err)
	}
	if len(ids) == 0 {
		return nil, fmt.Errorf("rubric %s contains no metric ids under metrics blocks", path)
	}
	return ids, nil
}

func stripMarkdownFence(raw []byte) []byte {
	trimmed := bytes.TrimSpace(raw)
	if bytes.HasPrefix(trimmed, []byte("```")) {
		if newline := bytes.IndexByte(trimmed, '\n'); newline >= 0 {
			trimmed = trimmed[newline+1:]
		}
		trimmed = bytes.TrimSpace(trimmed)
		if end := bytes.LastIndex(trimmed, []byte("```")); end >= 0 {
			trimmed = bytes.TrimSpace(trimmed[:end])
		}
	}
	return trimmed
}
