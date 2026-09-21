package gitrepo

import (
	"archive/tar"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Prepared struct {
	Root      string
	CommitSHA string
	RepoURL   string
}

// Prepare resolves the branch and materializes only the selected commit. It
// intentionally uses git archive instead of checkout: hooks, filters and
// project commands are never invoked by the pipeline.
func Prepare(ctx context.Context, repo, branch, workspace string) (Prepared, error) {
	if strings.TrimSpace(repo) == "" || strings.TrimSpace(branch) == "" {
		return Prepared{}, fmt.Errorf("repository and branch are required")
	}
	if strings.HasPrefix(branch, "-") || strings.ContainsAny(branch, "\x00\r\n\t") {
		return Prepared{}, fmt.Errorf("unsafe branch name %q", branch)
	}
	if err := os.MkdirAll(workspace, 0o700); err != nil {
		return Prepared{}, fmt.Errorf("create git workspace: %w", err)
	}

	source := repo
	if !isLocalRepository(repo) {
		cloneDir, err := os.MkdirTemp(workspace, "clone-")
		if err != nil {
			return Prepared{}, fmt.Errorf("create clone workspace: %w", err)
		}
		if err := run(ctx, workspace, "clone", "--no-checkout", "--filter=blob:none", "--branch", branch, repo, cloneDir); err != nil {
			return Prepared{}, fmt.Errorf("clone repository: %w", err)
		}
		source = cloneDir
	}

	sha, err := runOutput(ctx, source, "rev-parse", branch+"^{commit}")
	if err != nil {
		return Prepared{}, fmt.Errorf("resolve branch %q: %w", branch, err)
	}
	sha = strings.TrimSpace(sha)
	if len(sha) != 40 {
		return Prepared{}, fmt.Errorf("git returned non-full commit SHA %q", sha)
	}

	root, err := os.MkdirTemp(workspace, "snapshot-")
	if err != nil {
		return Prepared{}, fmt.Errorf("create snapshot workspace: %w", err)
	}
	archiveCmd := exec.CommandContext(ctx, "git", "-c", "core.hooksPath=/dev/null", "archive", "--format=tar", sha)
	archiveCmd.Dir = source
	archiveCmd.Env = safeGitEnv()
	stdout, err := archiveCmd.StdoutPipe()
	if err != nil {
		return Prepared{}, fmt.Errorf("open git archive: %w", err)
	}
	stderr, err := archiveCmd.StderrPipe()
	if err != nil {
		return Prepared{}, fmt.Errorf("open git archive errors: %w", err)
	}
	if err := archiveCmd.Start(); err != nil {
		return Prepared{}, fmt.Errorf("start git archive: %w", err)
	}
	if err := extractArchive(stdout, root); err != nil {
		_ = archiveCmd.Process.Kill()
		return Prepared{}, fmt.Errorf("extract git archive: %w", err)
	}
	if err := archiveCmd.Wait(); err != nil {
		errorText, _ := io.ReadAll(stderr)
		return Prepared{}, fmt.Errorf("git archive: %w: %s", err, strings.TrimSpace(string(errorText)))
	}
	return Prepared{Root: root, CommitSHA: sha, RepoURL: repo}, nil
}

func ResolveSHA(ctx context.Context, repo, branch string) (string, error) {
	value, err := runOutput(ctx, repo, "rev-parse", branch+"^{commit}")
	if err != nil {
		return "", err
	}
	value = strings.TrimSpace(value)
	if len(value) != 40 {
		return "", fmt.Errorf("git returned non-full commit SHA %q", value)
	}
	return value, nil
}

func isLocalRepository(repo string) bool {
	info, err := os.Stat(repo)
	return err == nil && info.IsDir()
}

func run(ctx context.Context, dir string, args ...string) error {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	cmd.Env = safeGitEnv()
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, strings.TrimSpace(string(output)))
	}
	return nil
}

func runOutput(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	cmd.Env = safeGitEnv()
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return "", fmt.Errorf("%w: %s", err, strings.TrimSpace(string(exitErr.Stderr)))
		}
		return "", err
	}
	return string(output), nil
}

func safeGitEnv() []string {
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/bin:/bin"
	}
	return []string{
		"PATH=" + path,
		"GIT_CONFIG_NOSYSTEM=1",
		"GIT_CONFIG_GLOBAL=/dev/null",
		"GIT_TERMINAL_PROMPT=0",
		"GIT_OPTIONAL_LOCKS=0",
	}
}

func extractArchive(input io.Reader, destination string) error {
	reader := tar.NewReader(input)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		name := filepath.ToSlash(filepath.Clean(header.Name))
		if name == "." || filepath.IsAbs(name) || name == ".." || strings.HasPrefix(name, "../") || strings.Contains(name, `\`) {
			return fmt.Errorf("unsafe archive path %q", header.Name)
		}
		target := filepath.Join(destination, filepath.FromSlash(name))
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o700); err != nil {
				return err
			}
		case tar.TypeReg, tar.TypeRegA:
			if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
				return err
			}
			file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
			if err != nil {
				return err
			}
			_, copyErr := io.Copy(file, reader)
			closeErr := file.Close()
			if copyErr != nil {
				return copyErr
			}
			if closeErr != nil {
				return closeErr
			}
		case tar.TypeSymlink, tar.TypeLink:
			// Symlinks can escape the snapshot and are not needed for static analysis.
			continue
		default:
			continue
		}
	}
}
