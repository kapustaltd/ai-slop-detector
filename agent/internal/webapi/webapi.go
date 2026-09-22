package webapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	StatusQueued    = "queued"
	StatusRunning   = "running"
	StatusSucceeded = "succeeded"
	StatusFailed    = "failed"
)

var (
	ErrBusy          = errors.New("active run limit reached")
	ErrNotFound      = errors.New("run not found")
	ErrUnauthorized  = errors.New("authorization required")
	requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
	branchPattern    = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$`)
)

type Request struct {
	RepositoryURL string `json:"repository_url"`
	RepositoryID  string `json:"repository_id"`
	Branch        string `json:"branch"`
	Area          string `json:"area"`

	// ID is assigned by the manager and never decoded from HTTP.
	ID string `json:"-"`
}

type Summary struct {
	RunID       string  `json:"run_id"`
	TeamsTotal  int     `json:"teams_total"`
	TeamsDone   int     `json:"teams_done"`
	TeamsFailed int     `json:"teams_failed"`
	AreasDone   int     `json:"areas_done"`
	AreasFailed int     `json:"areas_failed"`
	DurationMS  int64   `json:"duration_ms"`
	CostUSD     float64 `json:"cost_usd"`
}

type Job struct {
	ID            string            `json:"id"`
	Status        string            `json:"status"`
	RepositoryID  string            `json:"repository_id"`
	RepositoryURL string            `json:"repository_url"`
	Branch        string            `json:"branch"`
	Area          string            `json:"area"`
	Progress      map[string]string `json:"progress"`
	CreatedAt     string            `json:"created_at"`
	StartedAt     string            `json:"started_at,omitempty"`
	FinishedAt    string            `json:"finished_at,omitempty"`
	Logs          []string          `json:"logs,omitempty"`
	Summary       *Summary          `json:"summary,omitempty"`
	Error         string            `json:"error,omitempty"`
}

type Execute func(context.Context, Request, io.Writer) (Summary, error)

type Config struct {
	DataDir   string
	MaxActive int
	MaxStored int
	Execute   Execute
	Now       func() time.Time
	ID        func(time.Time, uint64) string
}

type Manager struct {
	mu       sync.RWMutex
	config   Config
	jobs     map[string]*Job
	active   int
	sequence uint64
}

func NewManager(config Config) (*Manager, error) {
	if config.Execute == nil {
		return nil, errors.New("webapi execute function is required")
	}
	if config.DataDir == "" {
		return nil, errors.New("webapi data directory is required")
	}
	if config.MaxActive <= 0 {
		config.MaxActive = 1
	}
	if config.MaxStored <= 0 {
		config.MaxStored = 50
	}
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.ID == nil {
		config.ID = defaultID
	}
	if err := os.MkdirAll(filepath.Join(config.DataDir, "jobs"), 0o750); err != nil {
		return nil, fmt.Errorf("create webapi data directory: %w", err)
	}
	manager := &Manager{config: config, jobs: make(map[string]*Job)}
	if err := manager.loadPersisted(); err != nil {
		return nil, err
	}
	return manager, nil
}

func (m *Manager) loadPersisted() error {
	entries, err := os.ReadDir(filepath.Join(m.config.DataDir, "jobs"))
	if err != nil {
		return fmt.Errorf("read persisted jobs: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(m.config.DataDir, "jobs", entry.Name()))
		if err != nil {
			return fmt.Errorf("read persisted job %s: %w", entry.Name(), err)
		}
		var job Job
		if err := json.Unmarshal(data, &job); err != nil || job.ID == "" {
			continue
		}
		if job.Status == StatusQueued || job.Status == StatusRunning {
			job.Status = StatusFailed
			job.Error = "сервис был перезапущен до завершения прогона"
			job.Progress = progressFor(job.Area, StatusFailed)
			job.FinishedAt = m.config.Now().UTC().Format(time.RFC3339)
		}
		m.jobs[job.ID] = &job
	}
	m.pruneLocked()
	return nil
}

func (m *Manager) Create(ctx context.Context, request Request) (Job, error) {
	if err := ValidateRequest(request); err != nil {
		return Job{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.active >= m.config.MaxActive {
		return Job{}, ErrBusy
	}
	now := m.config.Now().UTC()
	m.sequence++
	id := m.config.ID(now, m.sequence)
	request.ID = id
	job := &Job{
		ID: id, Status: StatusQueued, RepositoryID: request.RepositoryID,
		RepositoryURL: request.RepositoryURL, Branch: request.Branch, Area: request.Area,
		Progress: progressFor(request.Area, StatusQueued), CreatedAt: now.Format(time.RFC3339),
	}
	m.jobs[id] = job
	m.active++
	_ = m.persistLocked(job)
	// A job outlives the HTTP request that created it. Do not let a browser
	// disconnect cancel a repository clone or provider evaluation.
	go m.execute(context.WithoutCancel(ctx), request)
	return cloneJob(job), nil
}

func (m *Manager) Get(id string) (Job, error) {
	m.mu.RLock()
	job, ok := m.jobs[id]
	if ok {
		defer m.mu.RUnlock()
		return cloneJob(job), nil
	}
	m.mu.RUnlock()
	return Job{}, ErrNotFound
}

func (m *Manager) execute(parent context.Context, request Request) {
	m.setRunning(request.ID)
	var logs logBuffer
	summary, err := m.config.Execute(parent, request, &logs)
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[request.ID]
	if !ok {
		m.active--
		return
	}
	finished := m.config.Now().UTC()
	job.FinishedAt = finished.Format(time.RFC3339)
	job.Logs = logs.Values()
	job.Summary = &summary
	if err != nil {
		job.Status = StatusFailed
		job.Error = sanitizeMessage(err.Error())
		job.Progress = progressFor(request.Area, StatusFailed)
	} else if summary.TeamsFailed > 0 || summary.AreasFailed > 0 {
		job.Status = StatusFailed
		job.Error = fmt.Sprintf("прогон завершён с ошибками: областей с ошибками — %d, команд с ошибками — %d", summary.AreasFailed, summary.TeamsFailed)
		job.Progress = progressFor(request.Area, StatusFailed)
	} else {
		job.Status = StatusSucceeded
		job.Error = ""
		job.Progress = progressFor(request.Area, StatusSucceeded)
	}
	m.active--
	_ = m.persistLocked(job)
	m.pruneLocked()
}

func (m *Manager) setRunning(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	job, ok := m.jobs[id]
	if !ok {
		return
	}
	now := m.config.Now().UTC()
	job.Status = StatusRunning
	job.StartedAt = now.Format(time.RFC3339)
	job.Progress = progressFor(job.Area, StatusRunning)
	_ = m.persistLocked(job)
}

func (m *Manager) persistLocked(job *Job) error {
	path := filepath.Join(m.config.DataDir, "jobs", job.ID+".json")
	temporary := path + ".tmp"
	data, err := json.MarshalIndent(job, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(temporary, append(data, '\n'), 0o640); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}

func (m *Manager) pruneLocked() {
	if len(m.jobs) <= m.config.MaxStored {
		return
	}
	for id, job := range m.jobs {
		if job.Status == StatusQueued || job.Status == StatusRunning {
			continue
		}
		delete(m.jobs, id)
		_ = os.Remove(filepath.Join(m.config.DataDir, "jobs", id+".json"))
		if len(m.jobs) <= m.config.MaxStored {
			return
		}
	}
}

func ValidateRequest(request Request) error {
	if !requestIDPattern.MatchString(request.RepositoryID) {
		return fieldError("repository_id", "must contain 1–64 letters, numbers, dots, underscores or hyphens")
	}
	if !branchPattern.MatchString(request.Branch) || strings.Contains(request.Branch, "..") || strings.HasSuffix(request.Branch, "/") {
		return fieldError("branch", "contains unsafe characters")
	}
	if request.Area != "backend" && request.Area != "frontend" && request.Area != "both" {
		return fieldError("area", "must be backend, frontend or both")
	}
	parsed, err := url.Parse(request.RepositoryURL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || strings.Trim(parsed.Path, "/") == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return fieldError("repository_url", "must be an HTTPS repository URL without credentials, query or fragment")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "github.com" && host != "gitlab.com" && host != "gitverse.ru" {
		return fieldError("repository_url", "host must be github.com, gitlab.com or gitverse.ru")
	}
	if port := parsed.Port(); port != "" && port != "443" {
		return fieldError("repository_url", "only HTTPS port 443 is allowed")
	}
	return nil
}

type fieldValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func (e fieldValidationError) Error() string { return e.Field + ": " + e.Message }

func fieldError(field, message string) error {
	return fieldValidationError{Field: field, Message: message}
}

func progressFor(area, status string) map[string]string {
	if area == "both" {
		return map[string]string{"backend": status, "frontend": status}
	}
	return map[string]string{area: status}
}

func defaultID(now time.Time, sequence uint64) string {
	random := make([]byte, 3)
	if _, err := rand.Read(random); err != nil {
		return fmt.Sprintf("%s-%d", now.UTC().Format("20060102T150405.000000000Z"), sequence)
	}
	return now.UTC().Format("20060102T150405.000000000Z") + "-" + hex.EncodeToString(random)
}

func cloneJob(job *Job) Job {
	result := *job
	result.Progress = make(map[string]string, len(job.Progress))
	for key, value := range job.Progress {
		result.Progress[key] = value
	}
	result.Logs = append([]string(nil), job.Logs...)
	if job.Summary != nil {
		copy := *job.Summary
		result.Summary = &copy
	}
	return result
}

type logBuffer struct {
	values []string
}

func (b *logBuffer) Write(data []byte) (int, error) {
	for _, line := range strings.Split(string(data), "\n") {
		line = sanitizeMessage(line)
		if strings.TrimSpace(line) != "" {
			b.values = append(b.values, line)
		}
	}
	if len(b.values) > 100 {
		b.values = b.values[len(b.values)-100:]
	}
	return len(data), nil
}

func (b *logBuffer) Values() []string { return append([]string(nil), b.values...) }

func sanitizeMessage(message string) string {
	message = strings.TrimSpace(message)
	for _, marker := range []string{"sk-", "Bearer ", "api_key", "api-key", "token", "password", "secret"} {
		if index := strings.Index(strings.ToLower(message), strings.ToLower(marker)); index >= 0 {
			message = message[:index] + "[REDACTED]"
		}
	}
	if len(message) > 500 {
		message = message[:500] + "…"
	}
	return message
}

func ParseArea(area string) string {
	if area == "both" {
		return ""
	}
	return area
}
