package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registryapi"
)

func main() {
	flags := flag.NewFlagSet("registry-api", flag.ExitOnError)
	registryPath := flags.String("registry", "registry.yaml", "path to the operator registry")
	listen := flags.String("listen", "127.0.0.1:8080", "address to listen on")
	publicBundle := flags.String("public-bundle", "", "directory for live evaluated bundles")
	autoEvaluate := flags.Bool("auto-evaluate", false, "queue active teams for evaluation")
	runnerURL := flags.String("runner-url", "http://127.0.0.1:8081", "internal evaluation runner URL")
	dailyLimit := flags.Int("daily-limit", 10, "maximum automatic evaluations per UTC day")
	_ = flags.Parse(os.Args[1:])

	server, err := registryapi.New(*registryPath, os.Getenv("REGISTRY_API_TOKEN"))
	if err != nil {
		fail(err)
	}
	if *autoEvaluate && *publicBundle == "" {
		fail(fmt.Errorf("--auto-evaluate requires --public-bundle"))
	}
	if *autoEvaluate && os.Getenv("WEB_RUNNER_TOKEN") == "" {
		fail(fmt.Errorf("--auto-evaluate requires WEB_RUNNER_TOKEN"))
	}
	if *publicBundle != "" {
		var evaluator registryapi.TeamEvaluator
		if *autoEvaluate {
			evaluator = registryapi.RemoteEvaluator{URL: *runnerURL, Token: os.Getenv("WEB_RUNNER_TOKEN")}
		}
		if err := server.ConfigureEvaluation(*publicBundle, evaluator, *dailyLimit); err != nil {
			fail(err)
		}
	}
	httpServer := &http.Server{
		Addr:              *listen,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("registry API listening on %s", *listen)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
