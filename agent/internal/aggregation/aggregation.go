package aggregation

import (
	"fmt"
	"math"
	"sort"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

type MetricScore struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Weight     float64 `json:"weight"`
	Score      float64 `json:"score"`
	Max        float64 `json:"max"`
	Confidence string  `json:"confidence"`
}

type SubcategoryScore struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	Weight  float64       `json:"weight"`
	Score   float64       `json:"score"`
	Metrics []MetricScore `json:"metrics"`
}

type CategoryScore struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Weight        float64            `json:"weight"`
	Score         float64            `json:"score"`
	Subcategories []SubcategoryScore `json:"subcategories"`
}

type AreaScore struct {
	Area       string          `json:"area"`
	Score      float64         `json:"score"`
	Max        float64         `json:"max"`
	Categories []CategoryScore `json:"categories"`
}

type TeamScore struct {
	Total    float64            `json:"total"`
	Max      float64            `json:"max"`
	Areas    map[string]float64 `json:"areas"`
	Partial  bool               `json:"partial"`
	Statuses map[string]string  `json:"statuses"`
}

type RankedTeam struct {
	TeamID  string   `json:"team_id"`
	Name    string   `json:"name"`
	Rank    *int     `json:"rank"`
	Total   *float64 `json:"total"`
	Status  string   `json:"status"`
	Partial bool     `json:"partial"`
}

func Area(r rubric.Rubric, report contract.Report) (AreaScore, error) {
	if report.Meta.Area == "" {
		return AreaScore{}, fmt.Errorf("report area is required")
	}
	byID := make(map[string]contract.Metric, len(report.Metrics))
	for _, metric := range report.Metrics {
		byID[metric.ID] = metric
	}
	result := AreaScore{Area: report.Meta.Area, Max: r.Scale.Max}
	for _, category := range r.Categories {
		categoryResult := CategoryScore{ID: category.ID, Name: category.Name, Weight: category.Weight}
		for _, subcategory := range category.Subcategories {
			subcategoryResult := SubcategoryScore{ID: subcategory.ID, Name: subcategory.Name, Weight: subcategory.Weight}
			for _, metric := range subcategory.Metrics {
				value, ok := byID[metric.ID]
				if !ok {
					return AreaScore{}, fmt.Errorf("report is missing metric %q", metric.ID)
				}
				if value.Max <= 0 {
					return AreaScore{}, fmt.Errorf("metric %q has invalid max", metric.ID)
				}
				metricResult := MetricScore{ID: metric.ID, Name: metric.Name, Weight: metric.Weight, Score: value.Score, Max: value.Max, Confidence: value.Confidence}
				subcategoryResult.Metrics = append(subcategoryResult.Metrics, metricResult)
				subcategoryResult.Score += metric.Weight * normalize(value.Score, value.Max, r.Scale.Max)
			}
			categoryResult.Subcategories = append(categoryResult.Subcategories, subcategoryResult)
			categoryResult.Score += subcategory.Weight * subcategoryResult.Score
		}
		result.Categories = append(result.Categories, categoryResult)
		result.Score += category.Weight * categoryResult.Score
	}
	return result, nil
}

func Team(areaScores map[string]AreaScore, statuses map[string]string, areaWeights map[string]float64) (TeamScore, error) {
	result := TeamScore{Areas: make(map[string]float64), Statuses: make(map[string]string), Max: 10}
	for area, status := range statuses {
		result.Statuses[area] = status
	}
	totalWeight := 0.0
	for area, score := range areaScores {
		weight := areaWeights[area]
		if weight <= 0 {
			continue
		}
		result.Areas[area] = score.Score
		totalWeight += weight
	}
	if totalWeight == 0 {
		return result, fmt.Errorf("no completed area evaluations")
	}
	for area, score := range areaScores {
		weight := areaWeights[area]
		if weight > 0 {
			result.Total += score.Score * weight / totalWeight
		}
	}
	result.Partial = len(areaScores) < len(areaWeights)
	return result, nil
}

func Rank(teams []RankedTeam) []RankedTeam {
	result := append([]RankedTeam(nil), teams...)
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].Total == nil && result[j].Total != nil {
			return false
		}
		if result[i].Total != nil && result[j].Total == nil {
			return true
		}
		if result[i].Total != nil && result[j].Total != nil && *result[i].Total != *result[j].Total {
			return *result[i].Total > *result[j].Total
		}
		return result[i].TeamID < result[j].TeamID
	})
	var previous *float64
	currentRank := 0
	for index := range result {
		if result[index].Total == nil {
			result[index].Rank = nil
			continue
		}
		if previous == nil || math.Abs(*previous-*result[index].Total) > 1e-9 {
			currentRank = index + 1
			value := *result[index].Total
			previous = &value
		}
		rank := currentRank
		result[index].Rank = &rank
	}
	return result
}

func normalize(score, max, targetMax float64) float64 {
	if max == 0 {
		return 0
	}
	return score / max * targetMax
}
