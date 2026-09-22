package gitrepo

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrepareArchivesPinnedCommitWithoutSymlinks(t *testing.T) {
	repo := t.TempDir()
	if err := os.WriteFile(filepath.Join(repo, "main.go"), []byte("package main\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("/etc/passwd", filepath.Join(repo, "outside")); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"init", "-q", "-b", "main"}, {"config", "user.email", "test@example.invalid"}, {"config", "user.name", "Test"}, {"add", "."}, {"commit", "-qm", "fixture"}} {
		command := exec.Command("git", args...)
		command.Dir = repo
		if output, err := command.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, output)
		}
	}
	prepared, err := Prepare(context.Background(), repo, "main", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if len(prepared.CommitSHA) != 40 {
		t.Fatalf("unexpected SHA: %s", prepared.CommitSHA)
	}
	if _, err := os.Stat(filepath.Join(prepared.Root, "main.go")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(filepath.Join(prepared.Root, "outside")); !os.IsNotExist(err) {
		t.Fatalf("symlink escaped snapshot: %v", err)
	}
	if strings.Contains(prepared.Root, repo) {
		t.Fatalf("snapshot unexpectedly uses source path: %s", prepared.Root)
	}
}
