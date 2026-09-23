package pipeline

import (
	"strings"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/skill"
)

// Инструкция несёт только координаты прогона. Задачу оценки формулирует скилл
// (спека 003 FR-013a), поэтому здесь проверяется и обратное: в инструкции не должно
// быть ни рубрики, ни требований к структуре отчёта, ни содержимого файлов. meta-поля
// отчёта (версии, model, evaluated_at) в инструкции тоже не место — их подставляет
// пайплайн после декодирования ответа, модель их не пишет и не читает из инструкции.
func TestInstructionCarriesOnlyRunCoordinates(t *testing.T) {
	sha := strings.Repeat("a", 40)
	reviewSkill := skill.Skill{Name: "review-backend", Version: "2.0.0", Path: "../../.claude/skills/review-backend/SKILL.md"}

	instruction := buildInstruction(
		registry.Team{ID: "team-01", Repo: "https://example.com/team-01.git"},
		"backend", sha, "../../rubrics/backend.v1.yaml", "/tmp/teams-repos/snapshot-1", reviewSkill,
	)

	for _, expected := range []string{
		"review-backend", "team-01", "https://example.com/team-01.git", sha,
		"/tmp/teams-repos/snapshot-1", "../../rubrics/backend.v1.yaml",
	} {
		if !strings.Contains(instruction, expected) {
			t.Errorf("инструкция не содержит координату %q", expected)
		}
	}

	for _, forbidden := range []string{
		"line_start", "info/minor/major/critical", "overall_comment",
		"schema_version", "Файлы:", "Фрагменты:", "meta.model", "meta.evaluated_at",
	} {
		if strings.Contains(instruction, forbidden) {
			t.Errorf("инструкция подменяет скилл: найдено %q", forbidden)
		}
	}

	if len(instruction) > 700 {
		t.Errorf("инструкция разрослась до %d символов: задача должна жить в скилле", len(instruction))
	}
}
