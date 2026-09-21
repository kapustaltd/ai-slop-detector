package aggregation

import (
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

func TestAreaCalculatesBottomUp(t *testing.T) {
	r := rubric.Rubric{
		ID: "backend.v1", Version: "backend.v1", Scale: rubric.Scale{Min: 0, Max: 10, Anchors: []int{2, 5, 8, 10}},
		Categories: []rubric.Category{
			{
				ID: "cat", Name: "Category", Weight: 1,
				Subcategories: []rubric.Subcategory{{
					ID: "sub", Name: "Subcategory", Weight: 1,
					Metrics: []rubric.Metric{
						{ID: "a", Name: "A", Description: "A", Weight: .25, Anchors: rubric.MetricAnchors{Level2: "2", Level5: "5", Level8: "8", Level10: "10"}},
						{ID: "b", Name: "B", Description: "B", Weight: .75, Anchors: rubric.MetricAnchors{Level2: "2", Level5: "5", Level8: "8", Level10: "10"}},
					},
				}},
			},
		},
	}
	report := contract.Report{Meta: contract.Meta{Area: "backend"}, Metrics: []contract.Metric{{ID: "a", Score: 4, Max: 10}, {ID: "b", Score: 8, Max: 10}}}
	result, err := Area(r, report)
	if err != nil {
		t.Fatal(err)
	}
	if result.Score != 7 || result.Categories[0].Subcategories[0].Score != 7 {
		t.Fatalf("unexpected scores: %#v", result)
	}
}

func TestTeamNormalizesSingleArea(t *testing.T) {
	result, err := Team(map[string]AreaScore{"backend": {Area: "backend", Score: 7}}, map[string]string{"backend": "done"}, map[string]float64{"backend": .5, "frontend": .5})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 7 || !result.Partial {
		t.Fatalf("unexpected team score: %#v", result)
	}
}

func TestRankUsesCompetitionRanksAndStableTieBreak(t *testing.T) {
	a, b, c := 8.0, 8.0, 5.0
	result := Rank([]RankedTeam{{TeamID: "team-c", Total: &c}, {TeamID: "team-b", Total: &b}, {TeamID: "team-a", Total: &a}})
	if result[0].TeamID != "team-a" || result[1].TeamID != "team-b" || result[2].TeamID != "team-c" {
		t.Fatalf("unexpected order: %#v", result)
	}
	if *result[0].Rank != 1 || *result[1].Rank != 1 || *result[2].Rank != 3 {
		t.Fatalf("unexpected ranks: %#v", result)
	}
}
