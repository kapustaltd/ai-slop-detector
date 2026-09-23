package skill

import (
	"os"
	"path/filepath"
	"testing"
)

func write(t *testing.T, dir, area, body string) {
	t.Helper()
	path := filepath.Join(dir, "review-"+area)
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(path, "SKILL.md"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestLoadReadsDeclaredVersion(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "backend", "---\nname: review-backend\nmetadata:\n  skill_version: \"2.1.0\"\n---\n\n# Review\n")

	value, err := Load(dir, "backend")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if value.Version != "2.1.0" || value.Name != "review-backend" {
		t.Fatalf("unexpected skill: %+v", value)
	}
}

func TestLoadRejectsMissingVersion(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "frontend", "---\nname: review-frontend\n---\n\n# Review\n")

	if _, err := Load(dir, "frontend"); err == nil {
		t.Fatal("expected an error when skill_version is absent")
	}
}

func TestLoadRejectsNameMismatch(t *testing.T) {
	dir := t.TempDir()
	write(t, dir, "backend", "---\nname: review-something\nmetadata:\n  skill_version: \"1.0.0\"\n---\n")

	if _, err := Load(dir, "backend"); err == nil {
		t.Fatal("expected an error when the declared name does not match the area")
	}
}

func TestLoadRejectsMissingFile(t *testing.T) {
	if _, err := Load(t.TempDir(), "backend"); err == nil {
		t.Fatal("expected an error when SKILL.md is absent")
	}
}
