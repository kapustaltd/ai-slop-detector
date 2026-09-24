package pipeline

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
)

func TestProgressRecorderWritesBoundedConfirmedEvents(t *testing.T) {
	output := t.TempDir()
	now := func() time.Time { return time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC) }
	progress := newProgressRecorder(output, "alpha", now, progressAreas(nil))
	for i := 0; i < maxProgressEvents+4; i++ {
		progress.update("analyzing", "scan", "Файлы проверены", "Подтверждённое событие", "backend")
	}
	progress.verifiedFinding("backend", enrichment.EnrichedFinding{
		Finding:    contract.Finding{Title: "Подтверждённая проблема", Explanation: "Обработка ошибок неполная.", File: "main.go", LineStart: 2, LineEnd: 4},
		LinkStatus: "verified",
		Permalink:  "https://github.com/example/repo/blob/abc/main.go#L2-L4",
	})
	progress.verifiedFinding("backend", enrichment.EnrichedFinding{LinkStatus: "unverified", Permalink: "https://example.invalid"})

	data, err := os.ReadFile(filepath.Join(output, "progress", "alpha.json"))
	if err != nil {
		t.Fatal(err)
	}
	var snapshot map[string]any
	if err := json.Unmarshal(data, &snapshot); err != nil {
		t.Fatal(err)
	}
	if got := len(snapshot["events"].([]any)); got != maxProgressEvents {
		t.Fatalf("event count = %d, want %d", got, maxProgressEvents)
	}
	last := snapshot["events"].([]any)[maxProgressEvents-1].(map[string]any)
	if last["kind"] != "finding" || last["source"].(map[string]any)["file"] != "main.go" {
		t.Fatalf("verified finding not retained: %+v", last)
	}
}
