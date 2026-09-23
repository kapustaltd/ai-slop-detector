package registry

import "testing"

func TestValidateRepositoryURLs(t *testing.T) {
	tests := []struct {
		name    string
		repo    string
		wantErr bool
	}{
		{name: "https", repo: "https://github.com/example/team.git"},
		{name: "ssh", repo: "ssh://example.com/team.git"},
		{name: "absolute local file URL", repo: "file:///tmp/team.git"},
		{name: "relative local file URL", repo: "file://team.git", wantErr: true},
		{name: "file URL with host", repo: "file://localhost/tmp/team.git", wantErr: true},
		{name: "file URL with query", repo: "file:///tmp/team.git?branch=main", wantErr: true},
		{name: "credentials", repo: "https://user:password@example.com/team.git", wantErr: true},
		{name: "unsupported scheme", repo: "ftp://example.com/team.git", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			registry := Registry{Teams: []Team{{ID: "team-1", Name: "Team 1", Repo: test.repo, Branch: "main"}}}
			err := registry.Validate()
			if (err != nil) != test.wantErr {
				t.Fatalf("Validate() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}
