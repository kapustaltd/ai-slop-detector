package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/pipeline"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
)

func main() {
	if len(os.Args) < 2 || (os.Args[1] != "run" && os.Args[1] != "recalculate") {
		fmt.Fprintln(os.Stderr, "usage: runner <run|recalculate> [flags]")
		os.Exit(2)
	}
	recalculate := os.Args[1] == "recalculate"
	flags := flag.NewFlagSet(os.Args[1], flag.ExitOnError)
	registryPath := flags.String("registry", "registry.yaml", "path to the operator registry")
	rubricsDir := flags.String("rubrics-dir", "rubrics", "directory with versioned rubric YAML files")
	outputDir := flags.String("output", "out", "static bundle and raw output directory")
	workspaceDir := flags.String("workspace", "../teams-repos", "directory for team clones; must live outside the platform project tree")
	projectDir := flags.String("project-dir", ".", "platform project root: review skills are discovered from here")
	skillsDir := flags.String("skills-dir", ".claude/skills", "directory with review skills")
	providerBin := flags.String("provider-bin", "claude", "headless provider executable")
	teamID := flags.String("team", "", "evaluate only one team")
	area := flags.String("area", "", "evaluate only one area")
	parallel := flags.Int("max-parallel", 1, "maximum simultaneous area runs")
	force := flags.Bool("force", false, "ignore completed state and evaluate again")
	model := flags.String("model", "", "expected model identifier in the report metadata")
	githubTemplate := flags.String("github-template", "{base}/blob/{sha}/{path}#L{start}-L{end}", "GitHub permalink template")
	gitlabTemplate := flags.String("gitlab-template", "{base}/-/blob/{sha}/{path}#L{start}-{end}", "GitLab permalink template")
	gitverseTemplate := flags.String("gitverse-template", "", "GitVerse permalink template; empty disables links")
	_ = flags.Parse(os.Args[2:])

	reg, err := registry.Load(*registryPath)
	if err != nil {
		fail(err)
	}
	rubrics, err := loadRubrics(*rubricsDir)
	if err != nil {
		fail(err)
	}
	rubricPaths := map[string]string{}
	for _, area := range []string{"backend", "frontend"} {
		rubricPaths[area+".v1"] = filepath.Join(*rubricsDir, area+".v1.yaml")
	}
	config := pipeline.Config{
		OutputDir: *outputDir, WorkspaceDir: *workspaceDir, Registry: reg, Rubrics: rubrics,
		MaxParallel: *parallel, TeamID: *teamID, Area: *area, Force: *force, Recalculate: recalculate,
		ProjectDir: *projectDir, SkillsDir: *skillsDir, RubricPaths: rubricPaths, Model: *model,
		Templates: enrichment.TemplateConfig{GitHub: *githubTemplate, GitLab: *gitlabTemplate, GitVerse: *gitverseTemplate},
		Logger:    os.Stdout,
	}
	if !recalculate {
		config.Provider = provider.CommandProvider{Binary: *providerBin, ProjectDir: *projectDir, Timeout: 20 * time.Minute}
	}
	summary, err := (pipeline.Pipeline{}).Run(context.Background(), config)
	if err != nil {
		fail(err)
	}
	fmt.Printf("run=%s teams=%d done=%d failed=%d areas_done=%d areas_failed=%d cost_usd=%.4f duration_ms=%d\n", summary.RunID, summary.TeamsTotal, summary.TeamsDone, summary.TeamsFailed, summary.AreasDone, summary.AreasFailed, summary.CostUSD, summary.DurationMS)
}

func loadRubrics(directory string) (map[string]rubric.Rubric, error) {
	result := map[string]rubric.Rubric{}
	for _, area := range []string{"backend", "frontend"} {
		path := filepath.Join(directory, area+".v1.yaml")
		value, err := rubric.Load(path)
		if err != nil {
			return nil, err
		}
		result[area+".v1"] = value
	}
	return result, nil
}

func fail(err error) { fmt.Fprintln(os.Stderr, strings.TrimSpace(err.Error())); os.Exit(1) }
