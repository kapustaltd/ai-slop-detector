// Package skill читает метаданные скилла ревью с диска.
//
// Процедура оценки живёт в скилле (спека 002), поэтому и версия должна приходить
// оттуда: пайплайн не имеет права подставлять её флагом или значением по умолчанию
// (спека 003 FR-013e). Правка SKILL.md без повышения версии ломает прогон — это и есть
// техническая опора воспроизводимости из принципа I конституции.
package skill

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Skill struct {
	// Name — имя скилла, которым он называется при вызове.
	Name string
	// Version — объявленная версия, попадающая в meta.skill_version отчёта.
	Version string
	// Path — путь к SKILL.md, для сообщений об ошибках.
	Path string
}

type frontmatter struct {
	Name     string `yaml:"name"`
	Metadata struct {
		SkillVersion string `yaml:"skill_version"`
	} `yaml:"metadata"`
}

// Load читает скилл ревью для области из каталога скиллов.
func Load(skillsDir, area string) (Skill, error) {
	if strings.TrimSpace(area) == "" {
		return Skill{}, fmt.Errorf("area is required")
	}
	name := "review-" + area
	path := filepath.Join(skillsDir, name, "SKILL.md")
	content, err := os.ReadFile(path)
	if err != nil {
		return Skill{}, fmt.Errorf("read skill %s: %w", name, err)
	}
	parsed, err := parseFrontmatter(content)
	if err != nil {
		return Skill{}, fmt.Errorf("parse %s: %w", path, err)
	}
	if parsed.Metadata.SkillVersion == "" {
		return Skill{}, fmt.Errorf("%s must declare metadata.skill_version", path)
	}
	declared := parsed.Name
	if declared == "" {
		declared = name
	}
	if declared != name {
		return Skill{}, fmt.Errorf("%s declares name %q, expected %q", path, declared, name)
	}
	return Skill{Name: declared, Version: parsed.Metadata.SkillVersion, Path: path}, nil
}

func parseFrontmatter(content []byte) (frontmatter, error) {
	text := strings.ReplaceAll(string(content), "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return frontmatter{}, fmt.Errorf("missing YAML frontmatter")
	}
	rest := text[len("---\n"):]
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return frontmatter{}, fmt.Errorf("unterminated YAML frontmatter")
	}
	var result frontmatter
	if err := yaml.Unmarshal([]byte(rest[:end]), &result); err != nil {
		return frontmatter{}, err
	}
	return result, nil
}
