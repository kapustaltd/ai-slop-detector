package gitrepo

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// agentInstructionNames — файлы и каталоги, которые агентские инструменты читают как
// инструкции или конфигурацию, а не как данные.
var agentInstructionNames = map[string]bool{
	"CLAUDE.md":          true,
	"CLAUDE.local.md":    true,
	"AGENTS.md":          true,
	"AGENTS.override.md": true,
	".claude":            true,
	".codex":             true,
	".agents":            true,
	".mcp.json":          true,
	".cursorrules":       true,
}

// UntrustedSuffix добавляется к обезвреженным путям. Содержимое остаётся читаемым:
// документация команды — часть предмета оценки, её нельзя просто удалять.
const UntrustedSuffix = ".untrusted"

// NeutralizeAgentInstructions переименовывает в подготовленной копии всё, что Claude Code
// подхватил бы как инструкции проекта: CLAUDE.md, .claude/, .mcp.json и аналоги.
//
// Репозиторий команды — недоверенные данные (принцип IV конституции, спека 003 FR-007a).
// Клон лежит вне дерева проекта, но этого недостаточно: файл инструкций в читаемом
// каталоге всё равно может быть загружен. Переименование снимает это механически, а не
// надеждой на то, что модель проигнорирует указания.
//
// Возвращает список путей относительно root, которые были переименованы.
func NeutralizeAgentInstructions(root string) ([]string, error) {
	if strings.TrimSpace(root) == "" {
		return nil, fmt.Errorf("root is required")
	}
	var found []string
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == root {
			return nil
		}
		if !agentInstructionNames[entry.Name()] {
			return nil
		}
		relative, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		if renameErr := os.Rename(path, path+UntrustedSuffix); renameErr != nil {
			return fmt.Errorf("neutralize %s: %w", relative, renameErr)
		}
		found = append(found, relative)
		if entry.IsDir() {
			return fs.SkipDir
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return found, nil
}
