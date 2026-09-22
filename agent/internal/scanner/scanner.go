package scanner

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	defaultMaxFileBytes  = 24 * 1024
	defaultMaxTotalBytes = 180 * 1024
	defaultMaxFiles      = 2000
)

var secretPattern = regexp.MustCompile(`(?i)(api[_-]?key|access[_-]?token|secret|password|passwd|private[_-]?key)\s*[:=]\s*["']?[^\s"']+`)

type Config struct {
	MaxFileBytes  int
	MaxTotalBytes int
	MaxFiles      int
}

type Snapshot struct {
	Root       string
	Files      []File
	LineCounts map[string]int
	Contents   map[string]string
	Warnings   []string
	Excluded   []string
	TotalBytes int
	Truncated  bool
}

type File struct {
	Path      string `json:"path"`
	SizeBytes int64  `json:"size_bytes"`
	LineCount int    `json:"line_count"`
	Included  bool   `json:"included"`
	Reason    string `json:"reason,omitempty"`
}

func Scan(root string, config Config) (Snapshot, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return Snapshot{}, fmt.Errorf("resolve repository root: %w", err)
	}
	info, err := os.Stat(root)
	if err != nil {
		return Snapshot{}, fmt.Errorf("stat repository root: %w", err)
	}
	if !info.IsDir() {
		return Snapshot{}, fmt.Errorf("repository path is not a directory: %s", root)
	}
	if config.MaxFileBytes <= 0 {
		config.MaxFileBytes = defaultMaxFileBytes
	}
	if config.MaxTotalBytes <= 0 {
		config.MaxTotalBytes = defaultMaxTotalBytes
	}
	if config.MaxFiles <= 0 {
		config.MaxFiles = defaultMaxFiles
	}

	snapshot := Snapshot{
		Root:       root,
		LineCounts: make(map[string]int),
		Contents:   make(map[string]string),
	}
	var paths []string
	err = filepath.Walk(root, func(path string, fileInfo os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == root {
			return nil
		}
		rel, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		if fileInfo.IsDir() {
			if isExcludedDirectory(rel) {
				return filepath.SkipDir
			}
			return nil
		}
		if fileInfo.Mode().IsRegular() {
			paths = append(paths, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		return Snapshot{}, fmt.Errorf("walk repository: %w", err)
	}
	sort.Strings(paths)

	for index, rel := range paths {
		path := filepath.Join(root, filepath.FromSlash(rel))
		fileInfo, statErr := os.Stat(path)
		if statErr != nil {
			return Snapshot{}, fmt.Errorf("stat file %s: %w", rel, statErr)
		}
		entry := File{Path: rel, SizeBytes: fileInfo.Size(), Included: false}
		if index >= config.MaxFiles {
			entry.Reason = "file_limit_exceeded"
			snapshot.Truncated = true
			snapshot.Warnings = append(snapshot.Warnings, "file_limit_exceeded")
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			entry.Reason = "unreadable"
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		entry.LineCount = lineCount(content)
		snapshot.LineCounts[rel] = entry.LineCount
		if isSensitiveFile(rel) {
			entry.Reason = "sensitive_file"
			snapshot.Warnings = append(snapshot.Warnings, "secret_redacted")
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		if isBinary(content) {
			entry.Reason = "binary"
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		if isExcludedFile(rel) {
			entry.Reason = "generated_or_dependency_artifact"
			snapshot.Excluded = append(snapshot.Excluded, rel)
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		if snapshot.TotalBytes >= config.MaxTotalBytes {
			entry.Reason = "total_budget_exceeded"
			snapshot.Truncated = true
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		if len(content) > config.MaxFileBytes {
			content = content[:config.MaxFileBytes]
			entry.Reason = "file_truncated"
			snapshot.Truncated = true
		}
		redacted := redact(content)
		remaining := config.MaxTotalBytes - snapshot.TotalBytes
		if len(redacted) > remaining {
			redacted = redacted[:remaining]
			entry.Reason = "total_budget_truncated"
			snapshot.Truncated = true
		}
		if len(redacted) == 0 {
			entry.Reason = "total_budget_exceeded"
			snapshot.Truncated = true
			snapshot.Files = append(snapshot.Files, entry)
			continue
		}
		entry.Included = true
		snapshot.TotalBytes += len(redacted)
		snapshot.Contents[rel] = string(redacted)
		snapshot.Files = append(snapshot.Files, entry)
	}
	if snapshot.Truncated {
		snapshot.Warnings = append(snapshot.Warnings, "repo_too_large")
	}
	snapshot.Warnings = uniqueSorted(snapshot.Warnings)
	return snapshot, nil
}

func isExcludedDirectory(rel string) bool {
	parts := strings.Split(filepath.ToSlash(rel), "/")
	for _, part := range parts {
		switch part {
		case ".git", "node_modules", "vendor", "dist", "build", "coverage", "target", ".next":
			return true
		}
	}
	return false
}

func isExcludedFile(rel string) bool {
	base := strings.ToLower(filepath.Base(rel))
	if strings.HasSuffix(base, ".lock") || strings.HasSuffix(base, ".min.js") || strings.HasSuffix(base, ".map") {
		return true
	}
	switch base {
	case "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock", "cargo.lock", "go.sum":
		return true
	}
	return false
}

func isSensitiveFile(rel string) bool {
	base := strings.ToLower(filepath.Base(rel))
	if base == ".env" || strings.HasPrefix(base, ".env.") || base == ".npmrc" || base == ".pypirc" {
		return true
	}
	for _, suffix := range []string{".pem", ".key", ".p12", ".pfx", ".jks"} {
		if strings.HasSuffix(base, suffix) {
			return true
		}
	}
	for _, marker := range []string{"credential", "secret", "password", "id_rsa"} {
		if strings.Contains(base, marker) {
			return true
		}
	}
	return false
}

// IsSensitivePath is shared by enrichment so a model cannot turn a finding
// into a way to publish .env files or private keys.
func IsSensitivePath(rel string) bool { return isSensitiveFile(rel) }

// RedactContent applies the same conservative redaction used in the bounded
// model snapshot to snippets stored in the public bundle.
func RedactContent(content []byte) []byte { return redact(content) }

func isBinary(content []byte) bool {
	return bytes.IndexByte(content, 0) >= 0
}

func lineCount(content []byte) int {
	if len(content) == 0 {
		return 0
	}
	count := bytes.Count(content, []byte{'\n'})
	if content[len(content)-1] != '\n' {
		count++
	}
	return count
}

func redact(content []byte) []byte {
	return secretPattern.ReplaceAllFunc(content, func(match []byte) []byte {
		text := string(match)
		separator := strings.IndexAny(text, ":=")
		if separator < 0 {
			return []byte("[REDACTED]")
		}
		return []byte(text[:separator+1] + " [REDACTED]")
	})
}

func uniqueSorted(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		seen[value] = struct{}{}
	}
	result := make([]string, 0, len(seen))
	for value := range seen {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
