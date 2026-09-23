package rubric

import (
	"math"
	"path/filepath"
	"strings"
	"testing"
)

func TestRepositoryRubricsAreValid(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	for _, name := range []string{"backend.v1.yaml", "frontend.v1.yaml"} {
		value, err := Load(filepath.Join(root, "rubrics", name))
		if err != nil {
			t.Fatal(err)
		}
		if len(value.MetricIDs()) == 0 {
			t.Fatalf("%s has no metric ids", name)
		}
	}
}

func TestRejectsInvalidWeightsAndScale(t *testing.T) {
	tests := []struct {
		name, want string
		mutate     func(*Rubric)
	}{
		{"wrong area keys", "missing backend", func(r *Rubric) { r.AreaWeights = map[string]float64{"wrong_a": .5, "wrong_b": .5} }},
		{"nan area weight", "non-finite", func(r *Rubric) { r.AreaWeights["backend"] = math.NaN() }},
		{"infinite category weight", "non-finite", func(r *Rubric) { r.Categories[0].Weight = math.Inf(1) }},
		{"nan metric weight", "non-finite", func(r *Rubric) { r.Categories[0].Subcategories[0].Metrics[0].Weight = math.NaN() }},
		{"wrong scale", "invalid score scale", func(r *Rubric) { r.Scale.Max = 100 }},
		{"nan scale", "invalid score scale", func(r *Rubric) { r.Scale.Max = math.NaN() }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r, err := Load("../../../rubrics/backend.v1.yaml")
			if err != nil {
				t.Fatal(err)
			}
			tc.mutate(&r)
			if err := r.Validate(); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want %q, got %v", tc.want, err)
			}
		})
	}
}
