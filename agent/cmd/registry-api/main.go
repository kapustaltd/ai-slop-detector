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
	_ = flags.Parse(os.Args[1:])

	server, err := registryapi.New(*registryPath, os.Getenv("REGISTRY_API_TOKEN"))
	if err != nil {
		fail(err)
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
