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
	"unicode/utf8"
)

var fullSHA = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)
var semanticVersion = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+$`)
var safeTeamID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

// Длины полей ниже — точное отражение schemas/evaluation-report.schema.json (maxLength у
// каждого поля), а не отдельное, более мягкое ограничение: раньше здесь была одна общая
// граница в 16 КиБ на любой текст, из-за чего Go-валидатор пропускал то, что схема бы
// отклонила. Значения совпадают с теми, что теперь явно перечислены в SKILL.md review-*, —
// скилл не читает схему заново, поэтому расхождение между этими константами и тем, что
// написано в скилле, стало бы тихой рассинхронизацией контракта.
const (
	maxOverallCommentLength = 5000
	maxSummaryLength        = 500
	maxRationaleLength      = 3000
	maxFindingTitleLength   = 200
	maxFindingTextLength    = 2000
	maxFindings             = 20
	maxWarningSize          = 64
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

// strayQuoteAfterIntField чинит наблюдавшуюся ошибку модели: лишняя закрывающая кавычка сразу
// после числового значения известного поля, например `"line_end": 23",` вместо `"line_end": 23,`.
// Якорится на буквальное имя поля перед числом — это специально уже, чем "цифра плюс кавычка",
// чтобы не задеть строковый текст, который случайно заканчивается на цифру перед настоящей
// закрывающей кавычкой (например `"поставь \"line_start\" 23"` в rationale). Поле должно быть
// известным числовым (line_start/line_end/score), не любым.
var strayQuoteAfterIntField = regexp.MustCompile(`("(?:line_start|line_end|score)"\s*:\s*-?\d+(?:\.\d+)?)"(\s*[,}\]])`)

func repairStrayNumericQuotes(raw []byte) []byte {
	return strayQuoteAfterIntField.ReplaceAll(raw, []byte(`$1$2`))
}

func DecodeReport(raw []byte) (Report, error) {
	cleaned := stripMarkdownFence(bytes.TrimSpace(raw))
	cleaned = repairStrayNumericQuotes(cleaned)
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

// DecodeReviewOutput читает компактный контракт между Codex и пайплайном. Канонический
// evaluation.v1 из него строит код: модель не повторяет meta/max и не пишет два почти
// одинаковых текста summary/rationale.
func DecodeReviewOutput(raw []byte) (ReviewOutput, error) {
	cleaned := stripMarkdownFence(bytes.TrimSpace(raw))
	start := bytes.IndexByte(cleaned, '{')
	end := bytes.LastIndexByte(cleaned, '}')
	if start < 0 || end < start {
		return ReviewOutput{}, errors.New("provider response does not contain a JSON object")
	}
	var output ReviewOutput
	decoder := json.NewDecoder(bytes.NewReader(cleaned[start : end+1]))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&output); err != nil {
		return ReviewOutput{}, fmt.Errorf("decode compact review JSON: %w", err)
	}
	return output, nil
}

// ExpandReviewOutput deterministically expands the small model response into the public
// evaluation.v1 contract. Validate remains the final authority for metric coverage, paths,
// line ranges and all semantic constraints.
func ExpandReviewOutput(output ReviewOutput, meta Meta, max float64) Report {
	report := Report{Meta: meta, OverallComment: output.Comment, Warnings: output.Warnings}
	for _, source := range output.Metrics {
		metric := Metric{
			ID: source.ID, Score: source.Score, Max: max, Confidence: source.Confidence,
			Summary:   source.Reason,
			Rationale: fmt.Sprintf("Сопоставление с якорем %d: %s", source.Anchor, source.Reason),
		}
		for _, evidence := range source.Evidence {
			metric.Findings = append(metric.Findings, Finding{
				Kind: evidence.Kind, Severity: evidence.Severity, File: evidence.File,
				LineStart: evidence.LineStart, LineEnd: evidence.LineEnd, Title: evidence.Title,
				Explanation: evidence.Note, Suggestion: evidence.Fix,
			})
		}
		report.Metrics = append(report.Metrics, metric)
	}
	return report
}

func ValidateReviewAnchors(output ReviewOutput) error {
	if len(output.Metrics) == 0 {
		return errors.New("compact review requires metrics")
	}
	if utf8.RuneCountInString(output.Comment) > 1000 {
		return errors.New("compact review comment is longer than 1000 characters")
	}
	for _, metric := range output.Metrics {
		switch metric.Anchor {
		case 2, 5, 8, 10:
		default:
			return fmt.Errorf("metric %q has unsupported anchor %d", metric.ID, metric.Anchor)
		}
		if utf8.RuneCountInString(metric.Reason) > 450 {
			return fmt.Errorf("metric %q reason is longer than 450 characters", metric.ID)
		}
		if len(metric.Evidence) < 1 || len(metric.Evidence) > 3 {
			return fmt.Errorf("metric %q requires 1-3 evidence items", metric.ID)
		}
		for _, evidence := range metric.Evidence {
			if evidence.Kind == "strength" && evidence.Fix != "" {
				return fmt.Errorf("metric %q strength evidence must use an empty fix", metric.ID)
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
	if utf8.RuneCountInString(report.OverallComment) > maxOverallCommentLength {
		return fmt.Errorf("overall_comment is longer than %d characters", maxOverallCommentLength)
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
		if utf8.RuneCountInString(metric.Summary) > maxSummaryLength {
			return fmt.Errorf("metric %q summary is longer than %d characters", metric.ID, maxSummaryLength)
		}
		if utf8.RuneCountInString(metric.Rationale) > maxRationaleLength {
			return fmt.Errorf("metric %q rationale is longer than %d characters", metric.ID, maxRationaleLength)
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
	seenWarnings := make(map[string]struct{}, len(report.Warnings))
	for _, warning := range report.Warnings {
		if utf8.RuneCountInString(warning) > maxWarningSize {
			return fmt.Errorf("warning %q is too long", warning)
		}
		if _, allowed := allowedWarnings[warning]; !allowed {
			return fmt.Errorf("unknown warning %q", warning)
		}
		if _, duplicate := seenWarnings[warning]; duplicate {
			return fmt.Errorf("warning %q appears more than once", warning)
		}
		seenWarnings[warning] = struct{}{}
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
	if utf8.RuneCountInString(finding.Title) > maxFindingTitleLength {
		return fmt.Errorf("metric %q finding %d title is longer than %d characters", metricID, index, maxFindingTitleLength)
	}
	if utf8.RuneCountInString(finding.Explanation) > maxFindingTextLength || utf8.RuneCountInString(finding.Suggestion) > maxFindingTextLength {
		return fmt.Errorf("metric %q finding %d contains text longer than %d characters", metricID, index, maxFindingTextLength)
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
