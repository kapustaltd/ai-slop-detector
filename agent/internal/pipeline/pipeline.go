package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/aggregation"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/bundle"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/gitrepo"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/scanner"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/skill"
)

const defaultMaxRetries = 2

type Config struct {
	OutputDir       string
	WorkspaceDir    string
	Registry        registry.Registry
	Rubrics         map[string]rubric.Rubric
	Provider        provider.Provider
	Templates       enrichment.TemplateConfig
	MaxParallel     int
	MaxRetries      int
	MaxSnippetLines int
	MaxSnippetBytes int
	ScannerConfig   scanner.Config
	// ProjectDir — корень проекта платформы: оттуда обнаруживаются скиллы ревью.
	ProjectDir string
	// SkillsDir — каталог скиллов; версия читается из SKILL.md (спека 003 FR-013e).
	SkillsDir string
	// RubricPaths — путь к файлу рубрики по версии; передаётся скиллу как координата.
	RubricPaths map[string]string
	Model       string
	TeamID      string
	Area        string
	Force       bool
	Recalculate bool
	Logger      io.Writer
	Now         func() time.Time
}

type Summary struct {
	RunID        string  `json:"run_id"`
	StartedAt    string  `json:"started_at"`
	FinishedAt   string  `json:"finished_at"`
	TeamsTotal   int     `json:"teams_total"`
	TeamsDone    int     `json:"teams_done"`
	TeamsFailed  int     `json:"teams_failed"`
	AreasDone    int     `json:"areas_done"`
	AreasFailed  int     `json:"areas_failed"`
	DurationMS   int64   `json:"duration_ms"`
	CostUSD      float64 `json:"cost_usd"`
	Recalculated bool    `json:"recalculated"`
}

type Pipeline struct{}

type savedEvaluation struct {
	TeamID      string                `json:"team_id"`
	Area        string                `json:"area"`
	CommitSHA   string                `json:"commit_sha"`
	RepoURL     string                `json:"repo_url"`
	Report      contract.Report       `json:"report"`
	Enriched    enrichment.Result     `json:"enriched"`
	Aggregate   aggregation.AreaScore `json:"aggregate"`
	Warnings    []string              `json:"warnings,omitempty"`
	DurationMS  int64                 `json:"duration_ms"`
	CostUSD     float64               `json:"cost_usd"`
	RawAttempts int                   `json:"raw_attempts"`
	Status      string                `json:"status"`
	Error       string                `json:"error,omitempty"`
}

type attemptRecord struct {
	Attempt   int    `json:"attempt"`
	StartedAt string `json:"started_at"`
	Raw       string `json:"raw,omitempty"`
	Error     string `json:"error,omitempty"`
}

type teamRun struct {
	Registry  registry.Team
	CommitSHA string
	Status    string
	Total     *float64
	Partial   bool
	Areas     map[string]bundle.Area
	Warnings  []string
	CostUSD   float64
	Meta      *bundle.TeamMeta
}

func (Pipeline) Run(ctx context.Context, config Config) (Summary, error) {
	if err := validateConfig(config); err != nil {
		return Summary{}, err
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.Logger == nil {
		config.Logger = io.Discard
	}
	if config.MaxParallel <= 0 {
		config.MaxParallel = 1
	}
	if config.MaxRetries <= 0 {
		config.MaxRetries = defaultMaxRetries
	}
	if config.MaxRetries > 2 {
		config.MaxRetries = 2
	}
	started := config.Now().UTC()
	runID := started.Format("20060102T150405.000000000Z0700")
	if config.Recalculate {
		return recalculate(ctx, config, runID, started)
	}
	release, err := acquireLock(config.OutputDir)
	if err != nil {
		return Summary{}, err
	}
	defer release()
	if err := os.MkdirAll(config.WorkspaceDir, 0o700); err != nil {
		return Summary{}, fmt.Errorf("create workspace: %w", err)
	}
	runID = uniqueRunID(config.OutputDir, runID)
	rawRoot := filepath.Join(config.OutputDir, "raw", runID)
	if err := os.MkdirAll(rawRoot, 0o750); err != nil {
		return Summary{}, fmt.Errorf("create raw output: %w", err)
	}

	teams := make([]teamRun, 0)
	for _, team := range config.Registry.Teams {
		if !team.Active || (config.TeamID != "" && config.TeamID != team.ID) {
			continue
		}
		result := teamRun{Registry: team, Status: "failed", Areas: make(map[string]bundle.Area)}
		prepared, prepareErr := gitrepo.Prepare(ctx, team.Repo, team.Branch, config.WorkspaceDir)
		if prepareErr != nil {
			result.Areas["backend"] = bundle.Area{Status: "failed", Error: sanitizeError(prepareErr)}
			result.Areas["frontend"] = bundle.Area{Status: "no_data"}
			teams = append(teams, result)
			logf(config.Logger, "team=%s failed: %s", team.ID, sanitizeError(prepareErr))
			continue
		}
		result.CommitSHA = prepared.CommitSHA
		// Репозиторий команды — недоверенные данные: файлы инструкций агентов
		// обезвреживаются до того, как скилл получит доступ к копии
		// (принцип IV конституции, спека 003 FR-007a).
		neutralized, neutralizeErr := gitrepo.NeutralizeAgentInstructions(prepared.Root)
		if neutralizeErr != nil {
			result.Areas["backend"] = bundle.Area{Status: "failed", Error: sanitizeError(neutralizeErr)}
			result.Areas["frontend"] = bundle.Area{Status: "no_data"}
			teams = append(teams, result)
			logf(config.Logger, "team=%s failed: %s", team.ID, sanitizeError(neutralizeErr))
			continue
		}
		if len(neutralized) > 0 {
			logf(config.Logger, "team=%s neutralized agent instruction files: %s", team.ID, strings.Join(neutralized, ", "))
		}
		areas := registry.ApplyOverrides(registry.DetectAreas(prepared.Root), team.Paths)
		if config.Area != "" {
			if path, ok := areas[config.Area]; ok {
				areas = map[string]string{config.Area: path}
			} else {
				areas = map[string]string{config.Area: "."}
			}
		}
		if len(areas) == 0 {
			result.Areas["backend"] = bundle.Area{Status: "failed", Error: "no analyzable areas found"}
			result.Areas["frontend"] = bundle.Area{Status: "no_data"}
			teams = append(teams, result)
			continue
		}
		var wait sync.WaitGroup
		semaphore := make(chan struct{}, config.MaxParallel)
		var mu sync.Mutex
		for _, area := range registry.SortedAreas(areas) {
			areaPath := areas[area]
			wait.Add(1)
			go func() {
				defer wait.Done()
				semaphore <- struct{}{}
				defer func() { <-semaphore }()
				item := runArea(ctx, config, team, prepared, area, areaPath, rawRoot)
				mu.Lock()
				result.Areas[area] = item.area
				result.CostUSD += item.costUSD
				if item.meta != nil && result.Meta == nil {
					result.Meta = item.meta
				}
				if item.area.Status == "done" {
					result.Status = "done"
				}
				result.Warnings = append(result.Warnings, item.warnings...)
				mu.Unlock()
			}()
		}
		wait.Wait()
		completed := 0
		for _, area := range result.Areas {
			if area.Status == "done" {
				completed++
			}
		}
		for _, expectedArea := range []string{"backend", "frontend"} {
			if _, exists := result.Areas[expectedArea]; !exists {
				result.Areas[expectedArea] = bundle.Area{Status: "no_data"}
			}
		}
		result.Partial = completed > 0 && completed < 2
		if completed == 0 {
			result.Status = "failed"
		}
		if total, ok := teamTotal(result.Areas, config.Rubrics, team); ok {
			result.Total = &total
		}
		teams = append(teams, result)
	}

	input := make([]bundle.InputTeam, 0, len(teams))
	summary := Summary{RunID: runID, StartedAt: started.Format(time.RFC3339), TeamsTotal: len(teams)}
	for _, team := range teams {
		if team.Status == "done" {
			summary.TeamsDone++
		} else {
			summary.TeamsFailed++
		}
		for _, area := range team.Areas {
			if area.Status == "done" {
				summary.AreasDone++
			} else if area.Status != "no_data" {
				summary.AreasFailed++
			}
		}
		input = append(input, bundle.InputTeam{Registry: team.Registry, Status: team.Status, CommitSHA: team.CommitSHA, Total: team.Total, Partial: team.Partial, Areas: team.Areas, Warnings: unique(team.Warnings), Meta: team.Meta})
		summary.CostUSD += team.CostUSD
	}
	if err := bundle.Write(config.OutputDir, config.Now(), input, config.Rubrics); err != nil {
		return Summary{}, err
	}
	finished := config.Now().UTC()
	summary.FinishedAt = finished.Format(time.RFC3339)
	summary.DurationMS = finished.Sub(started).Milliseconds()
	if err := writeJSON(filepath.Join(config.OutputDir, "summary.json"), summary); err != nil {
		return Summary{}, err
	}
	return summary, nil
}

type areaRunResult struct {
	area     bundle.Area
	costUSD  float64
	warnings []string
	meta     *bundle.TeamMeta
}

func runArea(ctx context.Context, config Config, team registry.Team, prepared gitrepo.Prepared, area, areaPath, rawRoot string) areaRunResult {
	if !config.Force {
		if saved, err := loadState(config.OutputDir, team.ID, area); err == nil && saved.Status == "done" && saved.CommitSHA == prepared.CommitSHA {
			return areaRunResult{area: toBundleArea(saved), meta: metaFromReport(saved.Report)}
		}
	}
	rubricValue, err := rubricFor(config.Rubrics, area)
	if err != nil {
		return failedArea(config, team, area, rawRoot, err)
	}
	root, err := registry.ResolveAreaPath(prepared.Root, areaPath)
	if err != nil {
		return failedArea(config, team, area, rawRoot, err)
	}
	snapshot, err := scanner.Scan(root, config.ScannerConfig)
	if err != nil {
		return failedArea(config, team, area, rawRoot, err)
	}
	reviewSkill, err := skill.Load(config.SkillsDir, area)
	if err != nil {
		return failedArea(config, team, area, rawRoot, err)
	}
	instruction := buildInstruction(team, area, prepared.CommitSHA, config.RubricPaths[rubricValue.Version], root, reviewSkill)
	started := time.Now()
	maxAttempts := config.MaxRetries + 1
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	var lastErr error
	var report contract.Report
	var response provider.Response
	attempts := 0
	rawDir := filepath.Join(rawRoot, team.ID, area)
	_ = os.MkdirAll(rawDir, 0o750)
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		attempts = attempt
		request := provider.Request{TeamID: team.ID, Area: area, RepoID: team.ID, RepoPath: root, CommitSHA: prepared.CommitSHA, RubricVersion: rubricValue.Version, RubricPath: config.RubricPaths[rubricValue.Version], Prompt: instruction}
		if lastErr != nil {
			request.Prompt += "\n\nПредыдущий ответ отклонён валидатором. Исправь только эту ошибку и верни полный JSON:\n" + sanitizeError(lastErr)
		}
		attemptStarted := time.Now().UTC()
		if config.Provider == nil {
			lastErr = errors.New("provider is not configured")
			_ = saveAttempt(rawDir, attemptRecord{Attempt: attempt, StartedAt: attemptStarted.Format(time.RFC3339), Error: lastErr.Error()})
			continue
		}
		response, err = config.Provider.Evaluate(ctx, request)
		record := attemptRecord{Attempt: attempt, StartedAt: attemptStarted.Format(time.RFC3339)}
		if err != nil {
			lastErr = err
			record.Error = sanitizeError(err)
		} else {
			record.Raw = string(response.Raw)
		}
		if saveErr := saveAttempt(rawDir, record); saveErr != nil && err == nil {
			lastErr = saveErr
		}
		if err != nil {
			continue
		}
		decoded, decodeErr := contract.DecodeReport(response.Raw)
		if decodeErr != nil {
			lastErr = decodeErr
			continue
		}
		if decoded.Meta.RubricVersion != rubricValue.Version {
			lastErr = fmt.Errorf("meta.rubric_version must be %q, got %q", rubricValue.Version, decoded.Meta.RubricVersion)
			continue
		}
		if decoded.Meta.SkillVersion != reviewSkill.Version {
			lastErr = fmt.Errorf("meta.skill_version must be %q as declared in %s, got %q", reviewSkill.Version, reviewSkill.Path, decoded.Meta.SkillVersion)
			continue
		}
		if config.Model != "" && decoded.Meta.Model != config.Model {
			lastErr = fmt.Errorf("meta.model must be %q, got %q", config.Model, decoded.Meta.Model)
			continue
		}
		validationErr := contract.Validate(decoded, contract.ValidationContext{ExpectedArea: area, ExpectedRepoID: team.ID, ExpectedTeamID: team.ID, ExpectedSHA: prepared.CommitSHA, ExpectedRubric: rubricValue.Version, ExpectedMetrics: rubricValue.MetricIDs()})
		if validationErr != nil {
			lastErr = validationErr
			continue
		}
		report = decoded
		lastErr = nil
		break
	}
	duration := time.Since(started)
	if lastErr != nil {
		saved := savedEvaluation{TeamID: team.ID, Area: area, CommitSHA: prepared.CommitSHA, RepoURL: prepared.RepoURL, Status: "failed", Error: sanitizeError(lastErr), RawAttempts: attempts, DurationMS: duration.Milliseconds()}
		_ = writeJSON(filepath.Join(rawDir, "evaluation.json"), saved)
		return areaRunResult{area: bundle.Area{Status: "failed", Error: sanitizeError(lastErr), DurationMS: duration.Milliseconds(), RawAttempts: attempts}}
	}
	enriched := enrichment.Enrich(report, enrichment.Options{RepoRoot: root, RepoURL: prepared.RepoURL, CommitSHA: prepared.CommitSHA, Templates: config.Templates, MaxSnippetLines: config.MaxSnippetLines, MaxSnippetBytes: config.MaxSnippetBytes})
	aggregate, err := aggregation.Area(rubricValue, report)
	if err != nil {
		return failedArea(config, team, area, rawRoot, err)
	}
	warnings := append([]string{}, snapshot.Warnings...)
	warnings = append(warnings, report.Warnings...)
	saved := savedEvaluation{TeamID: team.ID, Area: area, CommitSHA: prepared.CommitSHA, RepoURL: prepared.RepoURL, Report: report, Enriched: enriched, Aggregate: aggregate, Warnings: unique(warnings), DurationMS: duration.Milliseconds(), CostUSD: response.Usage.CostUSD, RawAttempts: attempts, Status: "done"}
	if err := writeJSON(filepath.Join(rawDir, "evaluation.json"), saved); err != nil {
		return areaRunResult{area: bundle.Area{Status: "failed", Error: err.Error()}}
	}
	if err := writeJSON(filepath.Join(config.OutputDir, "state", team.ID, area+".json"), saved); err != nil {
		return areaRunResult{area: bundle.Area{Status: "failed", Error: err.Error()}}
	}
	return areaRunResult{area: toBundleArea(saved), costUSD: response.Usage.CostUSD, warnings: warnings, meta: metaFromReport(report)}
}

func failedArea(config Config, team registry.Team, area, rawRoot string, err error) areaRunResult {
	message := sanitizeError(err)
	_ = writeJSON(filepath.Join(rawRoot, team.ID, area, "evaluation.json"), savedEvaluation{TeamID: team.ID, Area: area, Status: "failed", Error: message})
	return areaRunResult{area: bundle.Area{Status: "failed", Error: message}}
}

func recalculate(ctx context.Context, config Config, runID string, started time.Time) (Summary, error) {
	_ = ctx
	release, err := acquireLock(config.OutputDir)
	if err != nil {
		return Summary{}, err
	}
	defer release()
	input := make([]bundle.InputTeam, 0)
	summary := Summary{RunID: runID, StartedAt: started.Format(time.RFC3339), Recalculated: true}
	for _, team := range config.Registry.Teams {
		if !team.Active || (config.TeamID != "" && config.TeamID != team.ID) {
			continue
		}
		result := teamRun{Registry: team, Status: "failed", Areas: map[string]bundle.Area{}}
		for _, area := range []string{"backend", "frontend"} {
			saved, loadErr := loadState(config.OutputDir, team.ID, area)
			if loadErr != nil {
				continue
			}
			if saved.Status == "done" {
				value, rubricErr := rubricFor(config.Rubrics, area)
				if rubricErr != nil {
					continue
				}
				aggregate, aggregateErr := aggregation.Area(value, saved.Report)
				if aggregateErr != nil {
					continue
				}
				saved.Aggregate = aggregate
				_ = writeJSON(filepath.Join(config.OutputDir, "state", team.ID, area+".json"), saved)
			}
			if result.Meta == nil && saved.Status == "done" {
				result.Meta = metaFromReport(saved.Report)
			}
			result.Areas[area] = toBundleArea(saved)
			if saved.Status == "done" {
				result.Status = "done"
				summary.AreasDone++
			} else {
				summary.AreasFailed++
			}
		}
		completed := 0
		for _, area := range result.Areas {
			if area.Status == "done" {
				completed++
			}
		}
		result.Partial = completed > 0 && completed < 2
		if total, ok := teamTotal(result.Areas, config.Rubrics, team); ok {
			result.Total = &total
		}
		if result.Status == "done" {
			summary.TeamsDone++
		} else {
			summary.TeamsFailed++
		}
		input = append(input, bundle.InputTeam{Registry: team, Status: result.Status, CommitSHA: "", Total: result.Total, Partial: result.Partial, Areas: result.Areas, Meta: result.Meta})
	}
	summary.TeamsTotal = len(input)
	if err := bundle.Write(config.OutputDir, config.Now(), input, config.Rubrics); err != nil {
		return Summary{}, err
	}
	finished := config.Now().UTC()
	summary.FinishedAt = finished.Format(time.RFC3339)
	summary.DurationMS = finished.Sub(started).Milliseconds()
	if err := writeJSON(filepath.Join(config.OutputDir, "summary.json"), summary); err != nil {
		return Summary{}, err
	}
	return summary, nil
}

func teamTotal(areas map[string]bundle.Area, rubrics map[string]rubric.Rubric, team registry.Team) (float64, bool) {
	areaScores := map[string]aggregation.AreaScore{}
	statuses := map[string]string{}
	weights := map[string]float64{"backend": 0.5, "frontend": 0.5}
	for area, value := range areas {
		statuses[area] = value.Status
		if value.Score == nil || value.Status != "done" {
			continue
		}
		version := area + ".v1"
		rubricValue, ok := rubrics[version]
		if !ok {
			continue
		}
		areaScores[area] = aggregation.AreaScore{Area: area, Score: *value.Score, Max: rubricValue.Scale.Max}
	}
	if len(areaScores) == 0 {
		return 0, false
	}
	result, err := aggregation.Team(areaScores, statuses, weights)
	if err != nil {
		return 0, false
	}
	_ = team
	return result.Total, true
}

func rubricFor(values map[string]rubric.Rubric, area string) (rubric.Rubric, error) {
	value, ok := values[area+".v1"]
	if !ok {
		return rubric.Rubric{}, fmt.Errorf("rubric for area %q is not configured", area)
	}
	return value, nil
}

func buildInstruction(team registry.Team, area, sha, rubricPath, repoPath string, reviewSkill skill.Skill) string {
	var builder strings.Builder
	fmt.Fprintf(&builder, "Проведи ревью через скилл %s.\n\n", reviewSkill.Name)
	builder.WriteString("Координаты прогона:\n")
	fmt.Fprintf(&builder, "- область: %s\n", area)
	fmt.Fprintf(&builder, "- team_id: %s\n", team.ID)
	fmt.Fprintf(&builder, "- repo: %s\n", team.Repo)
	fmt.Fprintf(&builder, "- commit_sha: %s\n", sha)
	fmt.Fprintf(&builder, "- рабочая копия репозитория команды: %s\n", repoPath)
	fmt.Fprintf(&builder, "- файл рубрики: %s\n", rubricPath)
	fmt.Fprintf(&builder, "- skill_version: %s\n", reviewSkill.Version)
	builder.WriteString("\nВерни только JSON-отчёт по контракту, без текста вокруг.\n")
	return builder.String()
}

func toBundleArea(value savedEvaluation) bundle.Area {
	maxScore := value.Aggregate.Max
	if maxScore <= 0 {
		maxScore = 10
	}
	result := bundle.Area{Status: value.Status, Max: maxScore, Categories: []bundle.Category{}, DurationMS: value.DurationMS, CostUSD: value.CostUSD, RawAttempts: value.RawAttempts, Error: value.Error}
	if value.Status == "done" {
		score := value.Aggregate.Score
		result.Score = &score
		result.Categories = bundle.CategoriesFromAggregate(value.Aggregate, value.Enriched)
	}
	metricDetails := make(map[string]aggregation.MetricScore)
	for _, category := range value.Aggregate.Categories {
		for _, subcategory := range category.Subcategories {
			for _, metric := range subcategory.Metrics {
				metricDetails[metric.ID] = metric
			}
		}
	}
	for _, metric := range value.Enriched.Metrics {
		details := metricDetails[metric.ID]
		result.Metrics = append(result.Metrics, bundle.Metric{ID: metric.ID, Name: details.Name, Weight: details.Weight, Score: metric.Score, Max: metric.Max, Confidence: metric.Confidence, Summary: metric.Summary, Rationale: metric.Rationale, Findings: metric.Findings})
	}
	return result
}

func metaFromReport(report contract.Report) *bundle.TeamMeta {
	if report.Meta.SchemaVersion == "" {
		return nil
	}
	return &bundle.TeamMeta{SchemaVersion: report.Meta.SchemaVersion, SkillVersion: report.Meta.SkillVersion, RubricVersion: report.Meta.RubricVersion, Model: report.Meta.Model, EvaluatedAt: report.Meta.EvaluatedAt}
}

func loadState(output, team, area string) (savedEvaluation, error) {
	data, err := os.ReadFile(filepath.Join(output, "state", team, area+".json"))
	if err != nil {
		return savedEvaluation{}, err
	}
	var result savedEvaluation
	if err := json.Unmarshal(data, &result); err != nil {
		return savedEvaluation{}, err
	}
	return result, nil
}

func saveAttempt(dir string, value attemptRecord) error {
	return writeJSON(filepath.Join(dir, fmt.Sprintf("attempt-%02d.json", value.Attempt)), value)
}

func acquireLock(output string) (func(), error) {
	if err := os.MkdirAll(output, 0o750); err != nil {
		return nil, err
	}
	path := filepath.Join(output, ".pipeline.lock")
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return nil, fmt.Errorf("output directory is locked by another pipeline: %w", err)
	}
	if _, err := file.WriteString(fmt.Sprintf("pid=%d\n", os.Getpid())); err != nil {
		_ = file.Close()
		_ = os.Remove(path)
		return nil, err
	}
	_ = file.Close()
	return func() { _ = os.Remove(path) }, nil
}

func uniqueRunID(output, base string) string {
	for index := 0; ; index++ {
		candidate := base
		if index > 0 {
			candidate = fmt.Sprintf("%s-%02d", base, index)
		}
		if _, err := os.Stat(filepath.Join(output, "raw", candidate)); os.IsNotExist(err) {
			return candidate
		}
	}
}

func validateConfig(config Config) error {
	if config.OutputDir == "" {
		return errors.New("output directory is required")
	}
	if config.WorkspaceDir == "" {
		return errors.New("workspace directory is required")
	}
	if err := config.Registry.Validate(); err != nil {
		return err
	}
	if len(config.Rubrics) == 0 {
		return errors.New("rubrics are required")
	}
	if !config.Recalculate && config.Provider == nil {
		return errors.New("provider is required")
	}
	return nil
}

func writeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	temporary, err := os.CreateTemp(filepath.Dir(path), ".pipeline-*")
	if err != nil {
		return err
	}
	name := temporary.Name()
	defer os.Remove(name)
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func sanitizeError(err error) string {
	if err == nil {
		return ""
	}
	value := err.Error()
	if len(value) > 1024 {
		value = value[:1024]
	}
	return strings.Map(func(r rune) rune {
		if r >= 0x20 || r == '\n' || r == '\t' {
			return r
		}
		return ' '
	}, value)
}
func logf(writer io.Writer, format string, args ...any) {
	_, _ = fmt.Fprintf(writer, format+"\n", args...)
}
func unique(values []string) []string {
	seen := map[string]struct{}{}
	result := []string{}
	for _, value := range values {
		if _, ok := seen[value]; !ok {
			seen[value] = struct{}{}
			result = append(result, value)
		}
	}
	sort.Strings(result)
	return result
}
