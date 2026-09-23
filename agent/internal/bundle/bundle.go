package bundle

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/aggregation"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

const SchemaVersion = "0.1"

type Meta struct {
	BundleSchema   string   `json:"bundle_schema"`
	BuiltAt        string   `json:"built_at"`
	ReportSchema   string   `json:"report_schema"`
	RubricVersions []string `json:"rubric_versions"`
	SkillVersions  []string `json:"skill_versions"`
	Models         []string `json:"models"`
}

type Index struct {
	BundleSchema string      `json:"bundle_schema"`
	BuiltAt      string      `json:"built_at"`
	Meta         Meta        `json:"meta"`
	Teams        []IndexTeam `json:"teams"`
}

type IndexTeam struct {
	TeamID   string             `json:"team_id"`
	Name     string             `json:"name"`
	Rank     *int               `json:"rank"`
	Total    *float64           `json:"total"`
	Areas    map[string]float64 `json:"areas"`
	Status   string             `json:"status"`
	Warnings []string           `json:"warnings,omitempty"`
	Partial  bool               `json:"partial"`
}

type Team struct {
	BundleSchema string          `json:"bundle_schema"`
	BuiltAt      string          `json:"built_at"`
	TeamID       string          `json:"team_id"`
	Name         string          `json:"name"`
	Status       string          `json:"status"`
	CommitSHA    string          `json:"commit_sha,omitempty"`
	Total        *float64        `json:"total"`
	Partial      bool            `json:"partial"`
	Meta         *TeamMeta       `json:"meta,omitempty"`
	Areas        map[string]Area `json:"areas"`
	Warnings     []string        `json:"warnings,omitempty"`
}

type Area struct {
	Status     string     `json:"status"`
	Score      *float64   `json:"score"`
	Max        float64    `json:"max"`
	Categories []Category `json:"categories"`
	Metrics    []Metric   `json:"metrics,omitempty"`
	DurationMS int64      `json:"-"` // internal run metadata, not the public team schema
	CostUSD    float64    `json:"-"` // internal run metadata, not the public team schema
	Attempts   int        `json:"-"` // internal run metadata, not the public team schema
	Error      string     `json:"error,omitempty"`
}

type Metric struct {
	ID         string                       `json:"id"`
	Name       string                       `json:"name"`
	Weight     float64                      `json:"weight"`
	Score      float64                      `json:"score"`
	Max        float64                      `json:"max"`
	Confidence string                       `json:"confidence"`
	Summary    string                       `json:"summary"`
	Rationale  string                       `json:"rationale"`
	Findings   []enrichment.EnrichedFinding `json:"findings"`
}

type Category struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	Weight        float64       `json:"weight"`
	Score         float64       `json:"score"`
	Subcategories []Subcategory `json:"subcategories"`
}

type Subcategory struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Weight  float64  `json:"weight"`
	Score   float64  `json:"score"`
	Metrics []Metric `json:"metrics"`
}

type TeamMeta struct {
	SchemaVersion string `json:"schema_version"`
	SkillVersion  string `json:"skill_version"`
	RubricVersion string `json:"rubric_version"`
	Model         string `json:"model"`
	EvaluatedAt   string `json:"evaluated_at"`
}

type Stats struct {
	BundleSchema string      `json:"bundle_schema"`
	BuiltAt      string      `json:"built_at"`
	Meta         Meta        `json:"meta"`
	Areas        []AreaStats `json:"areas"`
}

type AreaStats struct {
	Area             string      `json:"area"`
	SampleSize       int         `json:"sample_size"`
	InsufficientData bool        `json:"insufficient_data"`
	Metrics          []NodeStats `json:"metrics"`
	Categories       []NodeStats `json:"categories"`
}

type NodeStats struct {
	ID     string  `json:"id"`
	Mean   float64 `json:"mean"`
	Median float64 `json:"median"`
	Count  int     `json:"count"`
}

type InputTeam struct {
	Registry  registry.Team
	Status    string
	CommitSHA string
	Total     *float64
	Partial   bool
	Areas     map[string]Area
	Warnings  []string
	Meta      *TeamMeta
}

func CategoriesFromAggregate(value aggregation.AreaScore, enriched enrichment.Result) []Category {
	details := make(map[string]Metric, len(enriched.Metrics))
	for _, metric := range enriched.Metrics {
		details[metric.ID] = Metric{ID: metric.ID, Score: metric.Score, Max: metric.Max, Confidence: metric.Confidence, Summary: metric.Summary, Rationale: metric.Rationale, Findings: metric.Findings}
	}
	result := make([]Category, 0, len(value.Categories))
	for _, category := range value.Categories {
		item := Category{ID: category.ID, Name: category.Name, Weight: category.Weight, Score: category.Score}
		for _, subcategory := range category.Subcategories {
			subitem := Subcategory{ID: subcategory.ID, Name: subcategory.Name, Weight: subcategory.Weight, Score: subcategory.Score}
			for _, metric := range subcategory.Metrics {
				detail := details[metric.ID]
				detail.ID = metric.ID
				detail.Name = metric.Name
				detail.Weight = metric.Weight
				detail.Score = metric.Score
				detail.Max = metric.Max
				detail.Confidence = metric.Confidence
				subitem.Metrics = append(subitem.Metrics, detail)
			}
			item.Subcategories = append(item.Subcategories, subitem)
		}
		result = append(result, item)
	}
	return result
}

func Write(output string, builtAt time.Time, teams []InputTeam, rubrics map[string]rubric.Rubric) error {
	if err := os.MkdirAll(filepath.Join(output, "teams"), 0o750); err != nil {
		return fmt.Errorf("create bundle directories: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(output, "rubrics"), 0o750); err != nil {
		return fmt.Errorf("create rubric directory: %w", err)
	}
	meta := buildMeta(builtAt, teams, rubrics)
	ranked := make([]aggregation.RankedTeam, 0, len(teams))
	for _, team := range teams {
		ranked = append(ranked, aggregation.RankedTeam{TeamID: team.Registry.ID, Name: team.Registry.Name, Total: team.Total, Status: team.Status, Partial: team.Partial})
	}
	ranked = aggregation.Rank(ranked)
	rankByID := make(map[string]aggregation.RankedTeam, len(ranked))
	for _, item := range ranked {
		rankByID[item.TeamID] = item
	}
	index := Index{BundleSchema: SchemaVersion, BuiltAt: meta.BuiltAt, Meta: meta, Teams: []IndexTeam{}}
	for _, team := range teams {
		item := rankByID[team.Registry.ID]
		index.Teams = append(index.Teams, IndexTeam{TeamID: team.Registry.ID, Name: team.Registry.Name, Rank: item.Rank, Total: team.Total, Areas: areaScores(team.Areas), Status: team.Status, Warnings: team.Warnings, Partial: team.Partial})
		areas := make(map[string]Area, len(team.Areas))
		for areaName, area := range team.Areas {
			if area.Max <= 0 {
				area.Max = 10
			}
			if area.Categories == nil {
				area.Categories = []Category{}
			}
			if area.Metrics == nil {
				area.Metrics = []Metric{}
			}
			areas[areaName] = area
		}
		teamFile := Team{BundleSchema: SchemaVersion, BuiltAt: builtAt.UTC().Format(time.RFC3339), TeamID: team.Registry.ID, Name: team.Registry.Name, Status: team.Status, CommitSHA: team.CommitSHA, Total: team.Total, Partial: team.Partial, Meta: team.Meta, Areas: areas, Warnings: team.Warnings}
		if err := writeJSON(filepath.Join(output, "teams", team.Registry.ID+".json"), teamFile); err != nil {
			return err
		}
	}
	sort.Slice(index.Teams, func(i, j int) bool {
		if index.Teams[i].Rank == nil && index.Teams[j].Rank != nil {
			return false
		}
		if index.Teams[i].Rank != nil && index.Teams[j].Rank == nil {
			return true
		}
		if index.Teams[i].Rank != nil && index.Teams[j].Rank != nil && *index.Teams[i].Rank != *index.Teams[j].Rank {
			return *index.Teams[i].Rank < *index.Teams[j].Rank
		}
		return index.Teams[i].TeamID < index.Teams[j].TeamID
	})
	if err := writeJSON(filepath.Join(output, "index.json"), index); err != nil {
		return err
	}
	for version, item := range rubrics {
		if err := writeJSON(filepath.Join(output, "rubrics", version+".json"), rubricBundle(item, builtAt)); err != nil {
			return err
		}
	}
	if err := writeJSON(filepath.Join(output, "stats.json"), buildStats(meta, teams, rubrics)); err != nil {
		return err
	}
	return nil
}

func buildMeta(builtAt time.Time, teams []InputTeam, rubrics map[string]rubric.Rubric) Meta {
	meta := Meta{BundleSchema: SchemaVersion, BuiltAt: builtAt.UTC().Format(time.RFC3339), ReportSchema: "1.0"}
	for version := range rubrics {
		meta.RubricVersions = append(meta.RubricVersions, version)
	}
	for _, team := range teams {
		if team.Meta == nil {
			continue
		}
		if team.Meta.SkillVersion != "" {
			meta.SkillVersions = append(meta.SkillVersions, team.Meta.SkillVersion)
		}
		if team.Meta.Model != "" {
			meta.Models = append(meta.Models, team.Meta.Model)
		}
	}
	sort.Strings(meta.RubricVersions)
	meta.SkillVersions = uniqueStrings(meta.SkillVersions)
	meta.Models = uniqueStrings(meta.Models)
	return meta
}

func buildStats(meta Meta, teams []InputTeam, rubrics map[string]rubric.Rubric) Stats {
	result := Stats{BundleSchema: SchemaVersion, BuiltAt: meta.BuiltAt, Meta: meta, Areas: []AreaStats{}}
	areas := map[string]map[string][]float64{}
	categoryScores := map[string]map[string][]float64{}
	for _, team := range teams {
		for areaName, area := range team.Areas {
			if area.Status != "done" {
				continue
			}
			if areas[areaName] == nil {
				areas[areaName] = map[string][]float64{}
				categoryScores[areaName] = map[string][]float64{}
			}
			for _, metric := range area.Metrics {
				areas[areaName][metric.ID] = append(areas[areaName][metric.ID], metric.Score)
			}
			for _, category := range area.Categories {
				categoryScores[areaName][category.ID] = append(categoryScores[areaName][category.ID], category.Score)
			}
		}
	}
	areaNames := make([]string, 0, len(areas))
	for area := range areas {
		areaNames = append(areaNames, area)
	}
	sort.Strings(areaNames)
	for _, areaName := range areaNames {
		metricValues := areas[areaName]
		resultArea := AreaStats{Area: areaName, Metrics: []NodeStats{}, Categories: []NodeStats{}}
		for _, values := range metricValues {
			if len(values) > resultArea.SampleSize {
				resultArea.SampleSize = len(values)
			}
		}
		resultArea.InsufficientData = resultArea.SampleSize < 2
		metricIDs := make([]string, 0, len(metricValues))
		for id := range metricValues {
			metricIDs = append(metricIDs, id)
		}
		sort.Strings(metricIDs)
		for _, id := range metricIDs {
			resultArea.Metrics = append(resultArea.Metrics, summarize(id, metricValues[id]))
		}
		categoryIDs := make([]string, 0, len(categoryScores[areaName]))
		for id := range categoryScores[areaName] {
			categoryIDs = append(categoryIDs, id)
		}
		sort.Strings(categoryIDs)
		for _, id := range categoryIDs {
			resultArea.Categories = append(resultArea.Categories, summarize(id, categoryScores[areaName][id]))
		}
		result.Areas = append(result.Areas, resultArea)
	}
	_ = rubrics
	return result
}

func summarize(id string, values []float64) NodeStats {
	copyValues := append([]float64(nil), values...)
	sort.Float64s(copyValues)
	mean := 0.0
	for _, value := range copyValues {
		mean += value
	}
	if len(copyValues) > 0 {
		mean /= float64(len(copyValues))
	}
	median := 0.0
	if len(copyValues) > 0 {
		middle := len(copyValues) / 2
		if len(copyValues)%2 == 0 {
			median = (copyValues[middle-1] + copyValues[middle]) / 2
		} else {
			median = copyValues[middle]
		}
	}
	return NodeStats{ID: id, Mean: math.Round(mean*10000) / 10000, Median: math.Round(median*10000) / 10000, Count: len(copyValues)}
}

func areaScores(areas map[string]Area) map[string]float64 {
	result := map[string]float64{}
	for name, area := range areas {
		if area.Score != nil {
			result[name] = *area.Score
		}
	}
	return result
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

func rubricBundle(value rubric.Rubric, builtAt time.Time) map[string]any {
	return map[string]any{
		"schema_version": "rubric.v1",
		"rubric_version": value.Version,
		"area":           value.Area,
		"bundle_schema":  SchemaVersion,
		"built_at":       builtAt.UTC().Format(time.RFC3339),
		"scale":          value.Scale,
		"area_weights":   value.AreaWeights,
		"categories":     value.Categories,
	}
}

func writeJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s: %w", path, err)
	}
	data = append(data, '\n')
	temporary, err := os.CreateTemp(filepath.Dir(path), ".bundle-*")
	if err != nil {
		return fmt.Errorf("create temporary %s: %w", path, err)
	}
	temporaryName := temporary.Name()
	defer os.Remove(temporaryName)
	if err := temporary.Chmod(0o640); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write %s: %w", path, err)
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	if err := os.Rename(temporaryName, path); err != nil {
		return fmt.Errorf("publish %s: %w", path, err)
	}
	return nil
}
