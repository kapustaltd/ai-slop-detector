package registryapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

func TestAnonymousTeamCreationKeepsOtherWritesProtected(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams:\n  - id: existing\n    name: Existing\n    repo: https://github.com/example/existing\n    branch: main\n    active: true\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path, "")
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"new-team","name":"New team","repo":"https://github.com/example/new","branch":"main","active":true}`)))
	if create.Code != http.StatusCreated {
		t.Fatalf("anonymous create: %d %s", create.Code, create.Body.String())
	}
	stored, err := registry.Load(path)
	if err != nil || len(stored.Teams) != 2 {
		t.Fatalf("created team was not persisted: teams=%d err=%v", len(stored.Teams), err)
	}
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(method, "/api/teams/new-team", nil))
		if response.Code != http.StatusForbidden {
			t.Errorf("anonymous %s: got %d, want 403", method, response.Code)
		}
	}
}

func TestAnonymousTeamCreationFromEmptyRegistry(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.yaml")
	if err := os.WriteFile(path, []byte("version: '1'\nteams: []\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	server, err := New(path, "")
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/teams", strings.NewReader(`{"id":"first","name":"First","repo":"https://github.com/example/first","branch":"main","active":true}`)))
	if response.Code != http.StatusCreated {
		t.Fatalf("first team: %d %s", response.Code, response.Body.String())
	}
}
