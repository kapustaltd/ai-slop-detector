package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/agent"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/scanner"
)

func main() {
	var (
		repoPath     = flag.String("repo", ".", "path to a prepared repository snapshot")
		repoID       = flag.String("repo-id", "", "stable repository identifier")
		teamID       = flag.String("team-id", "", "team identifier; defaults to repo-id")
		area         = flag.String("area", "", "review area: backend or frontend")
		commitSHA    = flag.String("commit-sha", "", "full 40-character commit SHA; defaults to git HEAD")
		rubricPath   = flag.String("rubric", "", "path to a rubric YAML file")
		outputPath   = flag.String("output", "-", "output report path, or - for stdout")
		skillVersion = flag.String("skill-version", "1.0.0", "agent skill version")
		maxAttempts  = flag.Int("max-attempts", 3, "maximum provider attempts")
	)
	flag.Parse()

	if err := run(*repoPath, *repoID, *teamID, *area, *commitSHA, *rubricPath, *outputPath, *skillVersion, *maxAttempts); err != nil {
		fmt.Fprintf(os.Stderr, "slop-agent: %v\n", err)
		os.Exit(1)
	}
}

func run(repoPath, repoID, teamID, area, commitSHA, rubricPath, outputPath, skillVersion string, maxAttempts int) error {
	if strings.TrimSpace(repoPath) == "" {
		return errors.New("--repo is required")
	}
	if repoID == "" {
		repoID = filepath.Base(filepath.Clean(repoPath))
	}
	if teamID == "" {
		teamID = repoID
	}
	if area != "backend" && area != "frontend" {
		return errors.New("--area must be backend or frontend")
	}
	if rubricPath == "" {
		return errors.New("--rubric is required")
	}
	if maxAttempts < 1 || maxAttempts > 5 {
		return errors.New("--max-attempts must be between 1 and 5")
	}

	root, err := filepath.Abs(repoPath)
	if err != nil {
		return fmt.Errorf("resolve --repo: %w", err)
	}
	rubricBytes, err := os.ReadFile(rubricPath)
	if err != nil {
		return fmt.Errorf("read rubric: %w", err)
	}
	rubricDefinition, err := rubric.Load(rubricPath)
	if err != nil {
		return err
	}
	metricIDs := rubricDefinition.MetricIDs()
	if rubricDefinition.Area != area {
		return fmt.Errorf("rubric area %q does not match --area %q", rubricDefinition.Area, area)
	}
	if commitSHA == "" {
		commitSHA, err = gitHead(root)
		if err != nil {
			return err
		}
	}
	if !isFullSHA(commitSHA) {
		return errors.New("--commit-sha must be a full 40-character hexadecimal SHA")
	}

	snapshot, err := scanner.Scan(root, scanner.Config{})
	if err != nil {
		return err
	}
	config, err := provider.ConfigFromEnv()
	if err != nil {
		return err
	}
	client, err := provider.New(config)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), config.Timeout*time.Duration(maxAttempts))
	defer cancel()
	result, err := agent.Run(ctx, client, agent.Input{
		RepoID:        repoID,
		TeamID:        teamID,
		Area:          area,
		CommitSHA:     commitSHA,
		SkillVersion:  skillVersion,
		RubricVersion: rubricDefinition.Version,
		Model:         config.Model,
		RubricText:    string(rubricBytes),
		MetricIDs:     metricIDs,
		Snapshot:      snapshot,
	}, maxAttempts)
	if err != nil {
		return err
	}
	reportBytes, err := contract.EncodeReport(result.Report)
	if err != nil {
		return fmt.Errorf("encode validated report: %w", err)
	}
	if outputPath == "-" {
		_, err = fmt.Println(string(reportBytes))
		return err
	}
	if err := os.WriteFile(outputPath, append(reportBytes, '\n'), 0600); err != nil {
		return fmt.Errorf("write report %s: %w", outputPath, err)
	}
	fmt.Fprintf(os.Stderr, "validated report written to %s after %d attempt(s)\n", outputPath, result.Attempts)
	return nil
}

func gitHead(root string) (string, error) {
	command := exec.Command("git", "-C", root, "rev-parse", "HEAD")
	output, err := command.Output()
	if err != nil {
		return "", fmt.Errorf("read git HEAD without executing repository code: %w", err)
	}
	return strings.TrimSpace(string(output)), nil
}

func isFullSHA(value string) bool {
	if len(value) != 40 {
		return false
	}
	for _, char := range value {
		if (char < '0' || char > '9') && (char < 'a' || char > 'f') && (char < 'A' || char > 'F') {
			return false
		}
	}
	return true
}
