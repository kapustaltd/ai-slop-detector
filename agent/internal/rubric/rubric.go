package rubric

import (
	"errors"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const weightTolerance = 0.001

// Rubric is the versioned three-level taxonomy used by both the model and the
// aggregation code. Scores are deliberately absent from this structure.
type Rubric struct {
	SchemaVersion string             `yaml:"schema_version" json:"schema_version"`
	RubricVersion string             `yaml:"rubric_version" json:"rubric_version"`
	Area          string             `yaml:"area" json:"area"`
	Scale         Scale              `yaml:"scale" json:"scale"`
	AreaWeights   map[string]float64 `yaml:"area_weights" json:"area_weights"`
	Categories    []Category         `yaml:"categories" json:"categories"`

	// Compatibility aliases for the first runtime slice. They are populated
	// from rubric_version after decoding and are not part of the YAML contract.
	ID      string `yaml:"-" json:"-"`
	Version string `yaml:"-" json:"-"`
}

type Scale struct {
	Min     float64 `yaml:"min" json:"min"`
	Max     float64 `yaml:"max" json:"max"`
	Anchors []int   `yaml:"anchors" json:"anchors"`
}

type Category struct {
	ID            string        `yaml:"id" json:"id"`
	Name          string        `yaml:"name" json:"name"`
	Weight        float64       `yaml:"weight" json:"weight"`
	Subcategories []Subcategory `yaml:"subcategories" json:"subcategories"`
}

type Subcategory struct {
	ID      string   `yaml:"id" json:"id"`
	Name    string   `yaml:"name" json:"name"`
	Weight  float64  `yaml:"weight" json:"weight"`
	Metrics []Metric `yaml:"metrics" json:"metrics"`
}

type Metric struct {
	ID          string        `yaml:"id" json:"id"`
	Name        string        `yaml:"name" json:"name"`
	Description string        `yaml:"description" json:"description"`
	Weight      float64       `yaml:"weight" json:"weight"`
	Anchors     MetricAnchors `yaml:"anchors" json:"anchors"`
}

type MetricAnchors struct {
	Level2  string `yaml:"2" json:"2"`
	Level5  string `yaml:"5" json:"5"`
	Level8  string `yaml:"8" json:"8"`
	Level10 string `yaml:"10" json:"10"`
}

func Load(path string) (Rubric, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Rubric{}, fmt.Errorf("read rubric %s: %w", path, err)
	}
	var result Rubric
	if err := yaml.Unmarshal(data, &result); err != nil {
		return Rubric{}, fmt.Errorf("decode rubric %s: %w", path, err)
	}
	result.ID = result.RubricVersion
	result.Version = result.RubricVersion
	if err := result.Validate(); err != nil {
		return Rubric{}, fmt.Errorf("validate rubric %s: %w", path, err)
	}
	return result, nil
}

func (r Rubric) Validate() error {
	if r.SchemaVersion != "rubric.v1" {
		return fmt.Errorf("schema_version must be rubric.v1, got %q", r.SchemaVersion)
	}
	if strings.TrimSpace(r.RubricVersion) == "" {
		return errors.New("rubric_version is required")
	}
	if r.Area != "backend" && r.Area != "frontend" {
		return fmt.Errorf("unsupported area %q", r.Area)
	}
	if r.RubricVersion != r.Area+".v1" {
		return fmt.Errorf("rubric_version %q does not match area %q", r.RubricVersion, r.Area)
	}
	if len(r.AreaWeights) != 2 {
		return errors.New("area_weights must contain backend and frontend")
	}
	for _, area := range []string{"backend", "frontend"} {
		if _, ok := r.AreaWeights[area]; !ok {
			return fmt.Errorf("area_weights is missing %s", area)
		}
	}
	if r.Scale.Min != 0 || r.Scale.Max != 10 {
		return fmt.Errorf("invalid score scale %.2f..%.2f", r.Scale.Min, r.Scale.Max)
	}
	if len(r.Scale.Anchors) == 0 {
		return errors.New("scale anchors are required")
	}
	for _, anchor := range r.Scale.Anchors {
		if float64(anchor) < r.Scale.Min || float64(anchor) > r.Scale.Max {
			return fmt.Errorf("scale anchor %d is outside the score scale", anchor)
		}
	}
	if len(r.Categories) == 0 {
		return errors.New("at least one category is required")
	}
	if err := validateWeights(categoryWeights(r.Categories), "categories"); err != nil {
		return err
	}
	seenCategories := map[string]struct{}{}
	seenMetrics := map[string]struct{}{}
	for _, category := range r.Categories {
		if category.ID == "" || category.Name == "" {
			return errors.New("category id and name are required")
		}
		if _, exists := seenCategories[category.ID]; exists {
			return fmt.Errorf("duplicate category %q", category.ID)
		}
		seenCategories[category.ID] = struct{}{}
		if len(category.Subcategories) == 0 {
			return fmt.Errorf("category %q has no subcategories", category.ID)
		}
		if err := validateWeights(subcategoryWeights(category.Subcategories), "subcategories of "+category.ID); err != nil {
			return err
		}
		seenSubcategories := map[string]struct{}{}
		for _, subcategory := range category.Subcategories {
			if subcategory.ID == "" || subcategory.Name == "" {
				return fmt.Errorf("subcategory in %q requires id and name", category.ID)
			}
			if _, exists := seenSubcategories[subcategory.ID]; exists {
				return fmt.Errorf("duplicate subcategory %q in category %q", subcategory.ID, category.ID)
			}
			seenSubcategories[subcategory.ID] = struct{}{}
			if len(subcategory.Metrics) == 0 {
				return fmt.Errorf("subcategory %q has no metrics", subcategory.ID)
			}
			if err := validateWeights(metricWeights(subcategory.Metrics), "metrics of "+subcategory.ID); err != nil {
				return err
			}
			for _, metric := range subcategory.Metrics {
				if metric.ID == "" || metric.Name == "" || metric.Description == "" {
					return fmt.Errorf("metric in %q requires id, name and description", subcategory.ID)
				}
				if _, exists := seenMetrics[metric.ID]; exists {
					return fmt.Errorf("duplicate metric %q", metric.ID)
				}
				seenMetrics[metric.ID] = struct{}{}
				if metric.Weight < 0 {
					return fmt.Errorf("metric %q has negative weight", metric.ID)
				}
				if metric.Anchors.Level2 == "" || metric.Anchors.Level5 == "" || metric.Anchors.Level8 == "" || metric.Anchors.Level10 == "" {
					return fmt.Errorf("metric %q requires anchors 2, 5, 8 and 10", metric.ID)
				}
			}
		}
	}
	if len(r.AreaWeights) > 0 {
		if err := validateWeightsMap(r.AreaWeights, "area weights"); err != nil {
			return err
		}
	}
	return nil
}

func (r Rubric) MetricIDs() map[string]struct{} {
	ids := make(map[string]struct{})
	for _, category := range r.Categories {
		for _, subcategory := range category.Subcategories {
			for _, metric := range subcategory.Metrics {
				ids[metric.ID] = struct{}{}
			}
		}
	}
	return ids
}

func (r Rubric) MetricMap() map[string]Metric {
	result := make(map[string]Metric)
	for _, category := range r.Categories {
		for _, subcategory := range category.Subcategories {
			for _, metric := range subcategory.Metrics {
				result[metric.ID] = metric
			}
		}
	}
	return result
}

func (r Rubric) AreaWeight(area string) float64 {
	if len(r.AreaWeights) == 0 {
		return 0
	}
	return r.AreaWeights[area]
}

func validateWeights(weights []float64, label string) error {
	total := 0.0
	for _, weight := range weights {
		if math.IsNaN(weight) || math.IsInf(weight, 0) {
			return fmt.Errorf("%s contain a non-finite weight", label)
		}
		if weight < 0 {
			return fmt.Errorf("%s contain a negative weight", label)
		}
		total += weight
	}
	if math.Abs(total-1) > weightTolerance {
		return fmt.Errorf("%s weights sum to %.6f, want 1.0", label, total)
	}
	return nil
}

func validateWeightsMap(weights map[string]float64, label string) error {
	keys := make([]string, 0, len(weights))
	for key := range weights {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	values := make([]float64, 0, len(keys))
	for _, key := range keys {
		values = append(values, weights[key])
	}
	return validateWeights(values, label)
}

func categoryWeights(values []Category) []float64 {
	result := make([]float64, 0, len(values))
	for _, value := range values {
		result = append(result, value.Weight)
	}
	return result
}

func subcategoryWeights(values []Subcategory) []float64 {
	result := make([]float64, 0, len(values))
	for _, value := range values {
		result = append(result, value.Weight)
	}
	return result
}

func metricWeights(values []Metric) []float64 {
	result := make([]float64, 0, len(values))
	for _, value := range values {
		result = append(result, value.Weight)
	}
	return result
}
