package bundle

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

// Publisher merges a successful single-team run into the public bundle.
// The persistent bundle is preferred over the seed so subsequent deploys do
// not discard teams that were evaluated through the web runner.
type Publisher struct {
	mu      sync.RWMutex
	root    string
	seed    string
	rubrics map[string]rubric.Rubric
}

func NewPublisher(root, seed string, rubrics map[string]rubric.Rubric) (*Publisher, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("public bundle directory is required")
	}
	if len(rubrics) == 0 {
		return nil, errors.New("public bundle rubrics are required")
	}
	return &Publisher{root: root, seed: seed, rubrics: rubrics}, nil
}

func (p *Publisher) Publish(runDirectory string, builtAt time.Time) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	source := p.root
	if _, err := os.Stat(filepath.Join(source, "index.json")); errors.Is(err, os.ErrNotExist) {
		source = p.seed
	}
	teams, err := readPublishedTeams(source)
	if err != nil {
		return fmt.Errorf("load current public bundle: %w", err)
	}
	latest, err := readPublishedTeams(runDirectory)
	if err != nil {
		return fmt.Errorf("load completed run bundle: %w", err)
	}
	if len(latest) == 0 {
		return errors.New("completed run contains no team bundle")
	}
	for id, team := range latest {
		teams[id] = team
	}

	parent := filepath.Dir(p.root)
	if err := os.MkdirAll(parent, 0o750); err != nil {
		return fmt.Errorf("create public bundle parent: %w", err)
	}
	staging, err := os.MkdirTemp(parent, ".public-bundle-")
	if err != nil {
		return fmt.Errorf("create public bundle staging directory: %w", err)
	}
	defer os.RemoveAll(staging)

	input := make([]InputTeam, 0, len(teams))
	ids := make([]string, 0, len(teams))
	for id := range teams {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		team := teams[id]
		for areaName, area := range team.Areas {
			if len(area.Metrics) == 0 {
				area.Metrics = metricsFromCategories(area.Categories)
				team.Areas[areaName] = area
			}
		}
		input = append(input, InputTeam{
			Registry:  registry.Team{ID: team.TeamID, Name: team.Name, Active: true},
			Status:    team.Status,
			CommitSHA: team.CommitSHA,
			Total:     team.Total,
			Partial:   team.Partial,
			Areas:     team.Areas,
			Warnings:  team.Warnings,
			Meta:      team.Meta,
		})
	}
	if err := Write(staging, builtAt, input, p.rubrics); err != nil {
		return fmt.Errorf("build public bundle: %w", err)
	}
	if err := replaceDirectory(p.root, staging); err != nil {
		return fmt.Errorf("publish public bundle: %w", err)
	}
	return nil
}

func (p *Publisher) Read(relativePath string) ([]byte, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return os.ReadFile(filepath.Join(p.root, filepath.FromSlash(relativePath)))
}

func readPublishedTeams(directory string) (map[string]Team, error) {
	result := map[string]Team{}
	if strings.TrimSpace(directory) == "" {
		return result, nil
	}
	entries, err := os.ReadDir(filepath.Join(directory, "teams"))
	if errors.Is(err, os.ErrNotExist) {
		entries = nil
		err = nil
	}
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(directory, "teams", entry.Name()))
		if err != nil {
			return nil, err
		}
		var team Team
		if err := json.Unmarshal(data, &team); err != nil {
			return nil, fmt.Errorf("decode %s: %w", entry.Name(), err)
		}
		if team.TeamID == "" || team.Name == "" {
			return nil, fmt.Errorf("team bundle %s has no id or name", entry.Name())
		}
		result[team.TeamID] = team
	}
	indexData, err := os.ReadFile(filepath.Join(directory, "index.json"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if err == nil {
		var index Index
		if err := json.Unmarshal(indexData, &index); err != nil {
			return nil, fmt.Errorf("decode index.json: %w", err)
		}
		for _, item := range index.Teams {
			if _, exists := result[item.TeamID]; exists {
				continue
			}
			areas := make(map[string]Area, len(item.Areas))
			for areaName, score := range item.Areas {
				value := score
				areas[areaName] = Area{Status: "done", Score: &value, Max: 10, Categories: []Category{}, Metrics: []Metric{}}
			}
			result[item.TeamID] = Team{
				BundleSchema: index.BundleSchema,
				BuiltAt:      index.BuiltAt,
				TeamID:       item.TeamID,
				Name:         item.Name,
				Status:       item.Status,
				Total:        item.Total,
				Partial:      item.Partial,
				Areas:        areas,
				Warnings:     item.Warnings,
			}
		}
	}
	return result, nil
}

func metricsFromCategories(categories []Category) []Metric {
	result := []Metric{}
	for _, category := range categories {
		for _, subcategory := range category.Subcategories {
			result = append(result, subcategory.Metrics...)
		}
	}
	return result
}

func replaceDirectory(destination, staging string) error {
	backup := destination + ".previous"
	_ = os.RemoveAll(backup)
	if err := os.Rename(destination, backup); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.Rename(staging, destination); err != nil {
		_ = os.Rename(backup, destination)
		return err
	}
	_ = os.RemoveAll(backup)
	return nil
}
