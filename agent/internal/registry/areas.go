package registry

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// DetectAreas deliberately uses file names and directory layout only. It
// never runs package managers, build scripts or tests from the repository.
func DetectAreas(root string) map[string]string {
	areas := make(map[string]string)
	entries, err := os.ReadDir(root)
	if err != nil {
		return areas
	}
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		switch strings.ToLower(entry.Name()) {
		case "backend", "server", "api", "service":
			areas["backend"] = entry.Name()
		case "frontend", "front-end", "web", "client", "ui":
			areas["frontend"] = entry.Name()
		}
	}

	rootFiles := make(map[string]struct{})
	for _, entry := range entries {
		if !entry.IsDir() {
			rootFiles[strings.ToLower(entry.Name())] = struct{}{}
		}
	}
	if _, ok := areas["backend"]; !ok && hasAny(rootFiles, "go.mod", "go.work", "pyproject.toml", "requirements.txt", "pom.xml", "build.gradle", "cargo.toml", "composer.json") {
		areas["backend"] = "."
	}
	if _, ok := areas["frontend"]; !ok && hasAnyPrefix(rootFiles, "package.json", "vite.config", "next.config", "astro.config") {
		areas["frontend"] = "."
	}
	if len(areas) == 0 {
		areas["backend"] = "."
	}
	return areas
}

func ApplyOverrides(detected map[string]string, overrides map[string]string) map[string]string {
	result := make(map[string]string, len(detected)+len(overrides))
	for key, value := range detected {
		result[key] = value
	}
	for key, value := range overrides {
		result[key] = value
	}
	return result
}

func SortedAreas(areas map[string]string) []string {
	result := make([]string, 0, len(areas))
	for area := range areas {
		result = append(result, area)
	}
	sort.Strings(result)
	return result
}

func ResolveAreaPath(root, areaPath string) (string, error) {
	if areaPath == "." {
		return root, nil
	}
	path := filepath.Join(root, filepath.FromSlash(areaPath))
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", os.ErrInvalid
	}
	return path, nil
}

func hasAny(values map[string]struct{}, names ...string) bool {
	for _, name := range names {
		if _, ok := values[name]; ok {
			return true
		}
	}
	return false
}

func hasAnyPrefix(values map[string]struct{}, names ...string) bool {
	for value := range values {
		for _, name := range names {
			if value == name || strings.HasPrefix(value, name) {
				return true
			}
		}
	}
	return false
}
