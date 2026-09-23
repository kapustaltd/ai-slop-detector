package registry

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var safeID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

type Registry struct {
	Version string `yaml:"version" json:"version"`
	Teams   []Team `yaml:"teams" json:"teams"`
}

type Team struct {
	ID     string            `yaml:"id" json:"id"`
	Name   string            `yaml:"name" json:"name"`
	Repo   string            `yaml:"repo" json:"repo"`
	Branch string            `yaml:"branch" json:"branch"`
	Active bool              `yaml:"active" json:"active"`
	Paths  map[string]string `yaml:"paths" json:"paths"`
}

func Load(path string) (Registry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Registry{}, fmt.Errorf("read registry %s: %w", path, err)
	}
	var result Registry
	if err := yaml.Unmarshal(data, &result); err != nil {
		return Registry{}, fmt.Errorf("decode registry %s: %w", path, err)
	}
	if err := result.Validate(); err != nil {
		return Registry{}, fmt.Errorf("validate registry %s: %w", path, err)
	}
	return result, nil
}

func (r Registry) Validate() error {
	if len(r.Teams) == 0 {
		return fmt.Errorf("teams must not be empty")
	}
	seen := make(map[string]struct{}, len(r.Teams))
	for _, team := range r.Teams {
		if !safeID.MatchString(team.ID) || strings.TrimSpace(team.Name) == "" {
			return fmt.Errorf("team id and name are required")
		}
		if _, exists := seen[team.ID]; exists {
			return fmt.Errorf("duplicate team %q", team.ID)
		}
		seen[team.ID] = struct{}{}
		if strings.TrimSpace(team.Repo) == "" {
			return fmt.Errorf("team %q repository is required", team.ID)
		}
		if strings.TrimSpace(team.Branch) == "" {
			return fmt.Errorf("team %q branch is required", team.ID)
		}
		if parsed, err := url.Parse(team.Repo); err != nil || (parsed.Scheme != "" && parsed.Host == "") {
			return fmt.Errorf("team %q has invalid repository URL %q", team.ID, team.Repo)
		}
		for area, path := range team.Paths {
			if area != "backend" && area != "frontend" {
				return fmt.Errorf("team %q has unsupported area override %q", team.ID, area)
			}
			if path == "" || filepath.IsAbs(path) || filepath.Clean(path) != path || strings.HasPrefix(path, "../") || path == ".." || strings.Contains(path, `\`) {
				return fmt.Errorf("team %q has unsafe path override %q", team.ID, path)
			}
		}
	}
	return nil
}

func (t Team) PathFor(area string) (string, bool) {
	path, ok := t.Paths[area]
	return path, ok
}
