package pipeline

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

const maxProgressEvents = 500

// progressRecorder persists a small, user-facing trace for the active evaluation.
// It deliberately stores pipeline facts and verified report references only.
type progressRecorder struct {
	mu       sync.Mutex
	path     string
	now      func() time.Time
	value    contract.EvaluationProgress
	sequence int
}

func newProgressRecorder(outputDir, teamID string, now func() time.Time, areas []contract.AreaProgress) *progressRecorder {
	return &progressRecorder{
		path: filepath.Join(outputDir, "progress", teamID+".json"), now: now,
		value: contract.EvaluationProgress{Status: "running", Stage: "analyzing", StartedAt: now().UTC().Format(time.RFC3339), Areas: areas, Events: []contract.Event{}},
	}
}

func (p *progressRecorder) update(stage, kind, title, detail, area string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if stage != "" {
		p.value.Stage = stage
	}
	if kind != "" {
		p.sequence++
		p.value.Events = append(p.value.Events, contract.Event{Sequence: p.sequence, At: p.now().UTC().Format(time.RFC3339), Kind: kind, Title: shortText(title, 160), Detail: shortText(detail, 500), Area: area})
		if len(p.value.Events) > maxProgressEvents {
			p.value.Events = append([]contract.Event(nil), p.value.Events[len(p.value.Events)-maxProgressEvents:]...)
		}
	}
	_ = writeJSON(p.path, p.value)
}

func (p *progressRecorder) setArea(area, status string, included, excluded, completed, total int) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for i := range p.value.Areas {
		if p.value.Areas[i].Area == area {
			p.value.Areas[i].Status = status
			if included >= 0 {
				p.value.Areas[i].IncludedFiles = included
			}
			if excluded >= 0 {
				p.value.Areas[i].ExcludedFiles = excluded
			}
			p.value.Areas[i].CompletedCategories = completed
			p.value.Areas[i].TotalCategories = total
			break
		}
	}
	_ = writeJSON(p.path, p.value)
}

func (p *progressRecorder) setStatus(status, stage string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.value.Status, p.value.Stage = status, stage
	_ = writeJSON(p.path, p.value)
}

func (p *progressRecorder) areaStatus(area string) string {
	if p == nil {
		return ""
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, item := range p.value.Areas {
		if item.Area == area {
			return item.Status
		}
	}
	return ""
}

func (p *progressRecorder) verifiedFinding(area string, finding enrichment.EnrichedFinding, categoryID ...string) {
	if p == nil || finding.LinkStatus != "verified" || finding.Permalink == "" {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	category := ""
	if len(categoryID) > 0 {
		category = categoryID[0]
	}
	p.sequence++
	p.value.Events = append(p.value.Events, contract.Event{
		CategoryID: category,
		Sequence:   p.sequence, At: p.now().UTC().Format(time.RFC3339), Kind: "finding",
		Title: shortText(finding.Title, 160), Detail: shortText(finding.Explanation, 500), Area: area,
		Source: &contract.Source{File: finding.File, LineStart: finding.LineStart, LineEnd: finding.LineEnd, Permalink: finding.Permalink},
	})
	if len(p.value.Events) > maxProgressEvents {
		p.value.Events = append([]contract.Event(nil), p.value.Events[len(p.value.Events)-maxProgressEvents:]...)
	}
	_ = writeJSON(p.path, p.value)
}

func progressAreas(rubrics map[string]rubric.Rubric) []contract.AreaProgress {
	areas := make([]contract.AreaProgress, 0, 2)
	for _, area := range []string{"backend", "frontend"} {
		areas = append(areas, contract.AreaProgress{Area: area, Status: "queued", TotalCategories: categoryCount(rubrics, area)})
	}
	return areas
}

func categoryCount(rubrics map[string]rubric.Rubric, area string) int {
	for _, value := range rubrics {
		if value.Area == area {
			return len(value.Categories)
		}
	}
	return 0
}

func areaCountLabel(count int) string {
	return fmt.Sprintf("%d %s", count, russianCountNoun(count, "область", "области", "областей"))
}

func pluralFiles(count int) string {
	return russianCountNoun(count, "файл", "файла", "файлов")
}

func russianCountNoun(count int, one, few, many string) string {
	lastTwo, last := count%100, count%10
	if lastTwo >= 11 && lastTwo <= 14 {
		return many
	}
	switch last {
	case 1:
		return one
	case 2, 3, 4:
		return few
	default:
		return many
	}
}

func shortText(value string, limit int) string {
	value = strings.Join(strings.Fields(value), " ")
	runes := []rune(value)
	if len(runes) > limit {
		return string(runes[:limit])
	}
	return value
}

// activity persists live public events. Tool completion updates its existing row.
func (p *progressRecorder) activity(area string, activity provider.Activity) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if activity.ToolID != "" {
		for i := range p.value.Events {
			event := &p.value.Events[i]
			if event.Area == area && event.ToolID == activity.ToolID {
				event.State = activity.State
				_ = writeJSON(p.path, p.value)
				return
			}
		}
	}
	p.sequence++
	p.value.Events = append(p.value.Events, contract.Event{Sequence: p.sequence, At: p.now().UTC().Format(time.RFC3339), Kind: activity.Kind, Title: shortText(activity.Title, 160), Detail: shortText(activity.Detail, 500), Area: area, CategoryID: activity.CategoryID, ToolID: activity.ToolID, State: activity.State})
	if len(p.value.Events) > maxProgressEvents {
		p.value.Events = append([]contract.Event(nil), p.value.Events[len(p.value.Events)-maxProgressEvents:]...)
	}
	_ = writeJSON(p.path, p.value)
}

func (p *progressRecorder) usage(area string, usage provider.Usage) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for i := range p.value.Areas {
		if p.value.Areas[i].Area == area {
			p.value.Areas[i].InputTokens = usage.InputTokens
			p.value.Areas[i].OutputTokens = usage.OutputTokens
		}
	}
	_ = writeJSON(p.path, p.value)
}
