package scanner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanRedactsSecretsAndExcludesArtifacts(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		"src/main.go":       "package main\n\nfunc main() {}\n",
		"src/config.go":     "const api_key = \"super-secret\"\n",
		".env":              "AGENT_API_KEY=super-secret\n",
		"package-lock.json": "{\"secret\":\"should-not-be-sent\"}\n",
		"node_modules/x.js": "module.exports = {}\n",
	}
	for name, content := range files {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}

	snapshot, err := Scan(root, Config{})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(snapshot.Contents["src/config.go"], "super-secret") {
		t.Fatal("secret was not redacted")
	}
	if _, included := snapshot.Contents[".env"]; included {
		t.Fatal(".env was included")
	}
	if _, included := snapshot.Contents["package-lock.json"]; included {
		t.Fatal("lockfile was included")
	}
	if _, included := snapshot.Contents["node_modules/x.js"]; included {
		t.Fatal("node_modules file was included")
	}
	if snapshot.LineCounts["src/main.go"] != 3 {
		t.Fatalf("line count = %d", snapshot.LineCounts["src/main.go"])
	}
}

func TestScanTruncatesTotalBudget(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "main.go"), []byte(strings.Repeat("x\n", 20)), 0600); err != nil {
		t.Fatal(err)
	}
	snapshot, err := Scan(root, Config{MaxFileBytes: 1024, MaxTotalBytes: 8})
	if err != nil {
		t.Fatal(err)
	}
	if !snapshot.Truncated {
		t.Fatal("expected truncation")
	}
	if snapshot.TotalBytes != 8 {
		t.Fatalf("total bytes = %d", snapshot.TotalBytes)
	}
}

func TestScanLimitsNumberOfFiles(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"a.go", "b.go", "c.go"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte("package p\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	snapshot, err := Scan(root, Config{MaxFiles: 2, MaxFileBytes: 100, MaxTotalBytes: 1000})
	if err != nil {
		t.Fatal(err)
	}
	if !snapshot.Truncated || !containsWarning(snapshot.Warnings, "file_limit_exceeded") {
		t.Fatalf("file limit was not reported: %#v", snapshot)
	}
}

func containsWarning(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}
