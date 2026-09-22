package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/enrichment"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/pipeline"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/provider"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/rubric"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/webapi"
)

func main() {
	flags := flag.NewFlagSet("web-runner", flag.ExitOnError)
	addr := flags.String("addr", envOr("WEB_RUNNER_ADDR", ":8080"), "HTTP listen address")
	dataDir := flags.String("data-dir", envOr("WEB_RUNNER_DATA_DIR", "./web-runner-data"), "job and pipeline output directory")
	workspaceDir := flags.String("workspace", envOr("WEB_RUNNER_WORKSPACE_DIR", filepath.Join(os.TempDir(), "ai-slop-detector-web")), "temporary clone workspace")
	rubricsDir := flags.String("rubrics-dir", envOr("WEB_RUNNER_RUBRICS_DIR", "../rubrics"), "directory with versioned rubric YAML files")
	providerBin := flags.String("provider-bin", envOr("WEB_RUNNER_PROVIDER_BIN", "claude"), "fixed headless provider executable")
	token := flags.String("token", os.Getenv("WEB_RUNNER_TOKEN"), "Bearer token; empty is allowed for local development")
	maxActive := flags.Int("max-active", envInt("WEB_RUNNER_MAX_ACTIVE", 1), "maximum active runs")
	maxStored := flags.Int("max-stored", envInt("WEB_RUNNER_MAX_STORED", 50), "maximum retained job records")
	_ = flags.Parse(os.Args[1:])

	rubrics, err := loadRubrics(*rubricsDir)
	if err != nil {
		log.Fatal(err)
	}
	manager, err := webapi.NewManager(webapi.Config{
		DataDir: *dataDir, MaxActive: *maxActive, MaxStored: *maxStored,
		Execute: pipelineExecutor(*dataDir, *workspaceDir, *providerBin, rubrics),
	})
	if err != nil {
		log.Fatal(err)
	}
	if *token == "" {
		log.Print("warning: WEB_RUNNER_TOKEN is empty; API authentication is disabled for local development")
	}

	server := &http.Server{Addr: *addr, Handler: webapi.NewHandler(manager, *token), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("web runner listening on %s", *addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func pipelineExecutor(dataDir, workspaceDir, providerBin string, rubrics map[string]rubric.Rubric) webapi.Execute {
	return func(ctx context.Context, request webapi.Request, logger io.Writer) (webapi.Summary, error) {
		return runPipeline(ctx, request, dataDir, workspaceDir, providerBin, rubrics, logger)
	}
}

func runPipeline(ctx context.Context, request webapi.Request, dataDir, workspaceDir, providerBin string, rubrics map[string]rubric.Rubric, logger io.Writer) (webapi.Summary, error) {
	config := pipeline.Config{
		OutputDir:    filepath.Join(dataDir, "runs", request.ID),
		WorkspaceDir: filepath.Join(workspaceDir, request.ID),
		Registry: registry.Registry{Version: "1", Teams: []registry.Team{{
			ID: request.RepositoryID, Name: request.RepositoryID, Repo: request.RepositoryURL,
			Branch: request.Branch, Active: true,
		}}},
		Rubrics: rubrics, Provider: provider.CommandProvider{Binary: providerBin, Timeout: 20 * time.Minute},
		MaxParallel: 1, Area: webapi.ParseArea(request.Area),
		Templates: enrichment.TemplateConfig{GitHub: "{base}/blob/{sha}/{path}#L{start}-L{end}", GitLab: "{base}/-/blob/{sha}/{path}#L{start}-{end}"},
		Logger:    logger,
	}
	summary, err := (pipeline.Pipeline{}).Run(ctx, config)
	return webapi.Summary{RunID: summary.RunID, TeamsTotal: summary.TeamsTotal, TeamsDone: summary.TeamsDone, TeamsFailed: summary.TeamsFailed, AreasDone: summary.AreasDone, AreasFailed: summary.AreasFailed, DurationMS: summary.DurationMS, CostUSD: summary.CostUSD}, err
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

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	var parsed int
	if _, err := fmt.Sscanf(value, "%d", &parsed); err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
