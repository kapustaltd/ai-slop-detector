package registryapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sync"
	"time"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/bundle"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/contract"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/pipeline"
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

type TeamEvaluator interface {
	Evaluate(context.Context, registry.Team) error
}

type progressTeamEvaluator interface {
	EvaluateWithProgress(context.Context, registry.Team, func(string)) error
}

type jobTeamEvaluator interface {
	EvaluateWithProgressAndJob(context.Context, registry.Team, func(string), func(string)) error
}

type evaluationProgress = contract.EvaluationProgress

type evaluationService struct {
	registryPath, publicDir string
	budgetPath              string
	evaluator               TeamEvaluator
	queue                   chan string
	mu                      sync.RWMutex
	states                  map[string]string
	progress                map[string]evaluationProgress
	jobIDs                  map[string]string
	started                 map[string]time.Time
	limit                   int
}

// ConfigureEvaluation enables live bundle reads. A nil evaluator exposes
// registered teams without starting model work.
func (s *Server) ConfigureEvaluation(publicDir string, evaluator TeamEvaluator, dailyLimit int) error {
	if publicDir == "" {
		return errors.New("public bundle directory is required")
	}
	if dailyLimit <= 0 {
		dailyLimit = 10
	}
	if err := os.MkdirAll(filepath.Dir(publicDir), 0o750); err != nil {
		return err
	}
	e := &evaluationService{registryPath: s.registryPath, publicDir: publicDir, budgetPath: filepath.Join(filepath.Dir(publicDir), "evaluation-budget.json"), evaluator: evaluator, queue: make(chan string, 32), states: map[string]string{}, progress: map[string]evaluationProgress{}, jobIDs: map[string]string{}, started: map[string]time.Time{}, limit: dailyLimit}
	if data, err := os.ReadFile(e.budgetPath); err == nil {
		if err := json.Unmarshal(data, &e.started); err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	s.evaluation = e
	if evaluator == nil {
		return nil
	}
	go e.work()
	registered, err := registry.Load(s.registryPath)
	if err != nil {
		return err
	}
	published := e.publishedTeams()
	for _, team := range registered.Teams {
		if team.Active {
			if _, exists := published[team.ID]; !exists {
				e.enqueue(team.ID)
			}
		}
	}
	return nil
}

func (e *evaluationService) enqueue(id string) bool {
	if e.evaluator == nil {
		return false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.states[id] == "running" {
		return false
	}
	today := time.Now().UTC().Format("2006-01-02")
	count := 0
	for _, at := range e.started {
		if at.UTC().Format("2006-01-02") == today {
			count++
		}
	}
	if count >= e.limit || len(e.queue) == cap(e.queue) {
		e.states[id] = "no_data"
		return false
	}
	e.started[id] = time.Now().UTC()
	data, err := json.Marshal(e.started)
	if err != nil {
		e.states[id] = "failed"
		return false
	}
	temp, err := os.CreateTemp(filepath.Dir(e.budgetPath), ".evaluation-budget-")
	if err != nil {
		e.states[id] = "failed"
		return false
	}
	defer os.Remove(temp.Name())
	if _, err = temp.Write(data); err == nil {
		err = temp.Close()
	} else {
		_ = temp.Close()
	}
	if err == nil {
		err = os.Rename(temp.Name(), e.budgetPath)
	}
	if err != nil {
		e.states[id] = "failed"
		return false
	}
	e.states[id] = "running"
	e.progress[id] = evaluationProgress{Status: "running", Stage: "waiting", StartedAt: e.started[id].Format(time.RFC3339), Areas: []contract.AreaProgress{}, Events: []contract.Event{}}
	e.queue <- id
	return true
}

func (e *evaluationService) setStage(id, stage string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	progress := e.progress[id]
	progress.Stage = stage
	progress.Status = "running"
	e.progress[id] = progress
}

func (e *evaluationService) setJob(id, jobID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.jobIDs[id] = jobID
}

func (e *evaluationService) work() {
	for id := range e.queue {
		registered, err := registry.Load(e.registryPath)
		if err == nil {
			found := false
			for _, team := range registered.Teams {
				if team.ID == id && team.Active {
					found = true
					ctx, cancel := context.WithTimeout(context.Background(), 45*time.Minute)
					e.setStage(id, "dispatching")
					if evaluator, ok := e.evaluator.(jobTeamEvaluator); ok {
						err = evaluator.EvaluateWithProgressAndJob(ctx, team, func(stage string) { e.setStage(id, stage) }, func(jobID string) { e.setJob(id, jobID) })
					} else if evaluator, ok := e.evaluator.(progressTeamEvaluator); ok {
						err = evaluator.EvaluateWithProgress(ctx, team, func(stage string) { e.setStage(id, stage) })
					} else {
						err = e.evaluator.Evaluate(ctx, team)
					}
					cancel()
					break
				}
			}
			if !found {
				err = errors.New("team is no longer active")
			}
		}
		e.mu.Lock()
		if err != nil {
			e.states[id] = "failed"
			progress := e.progress[id]
			progress.Status = "failed"
			e.progress[id] = progress
			log.Printf("evaluation team=%s failed: %v", id, err)
		} else {
			delete(e.states, id)
			progress := e.progress[id]
			progress.Status = "done"
			progress.Stage = "done"
			e.progress[id] = progress
		}
		e.mu.Unlock()
	}
}

func (s *Server) liveProgress(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !safeTeamID.MatchString(id) {
		writeError(w, http.StatusNotFound, "Команда не найдена")
		return
	}
	registered, err := registry.Load(s.registryPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось прочитать реестр команд")
		return
	}
	found := false
	for _, team := range registered.Teams {
		if team.ID == id && team.Active {
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "Команда не найдена")
		return
	}
	if s.evaluation != nil {
		s.evaluation.mu.RLock()
		progress, ok := s.evaluation.progress[id]
		state := s.evaluation.states[id]
		jobID := s.evaluation.jobIDs[id]
		started := s.evaluation.started[id]
		s.evaluation.mu.RUnlock()
		if ok {
			progress = s.evaluation.readProgressSnapshot(id, jobID, started, progress)
			writeJSON(w, http.StatusOK, progress)
			return
		}
		if state == "failed" || state == "no_data" {
			writeJSON(w, http.StatusOK, evaluationProgress{Status: state, Stage: "waiting", Areas: []contract.AreaProgress{}, Events: []contract.Event{}})
			return
		}
		if saved, ok := s.evaluation.publishedTeams()[id]; ok && saved.Status == "done" {
			writeJSON(w, http.StatusOK, evaluationProgress{Status: "done", Stage: "done", Areas: []contract.AreaProgress{}, Events: []contract.Event{}})
			return
		}
	}
	writeJSON(w, http.StatusOK, evaluationProgress{Status: "no_data", Stage: "waiting", Areas: []contract.AreaProgress{}, Events: []contract.Event{}})
}

func (e *evaluationService) readProgressSnapshot(id, jobID string, started time.Time, fallback evaluationProgress) evaluationProgress {
	if !safeJobID.MatchString(jobID) || jobID == "." || jobID == ".." {
		return fallback
	}
	path := filepath.Join(filepath.Dir(e.publicDir), "runs", jobID, "progress", id+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return fallback
	}
	var snapshot evaluationProgress
	if json.Unmarshal(data, &snapshot) != nil || snapshot.Areas == nil || snapshot.Events == nil {
		return fallback
	}
	if startedAt, err := time.Parse(time.RFC3339, snapshot.StartedAt); err != nil || startedAt.Truncate(time.Second).Before(started.Truncate(time.Second)) {
		return fallback
	}
	// Service state is authoritative for terminal status; event details remain run-scoped.
	snapshot.Status = fallback.Status
	if fallback.Status == "done" {
		snapshot.Stage = "done"
	}
	if fallback.StartedAt != "" {
		snapshot.StartedAt = fallback.StartedAt
	}
	return snapshot
}

func (e *evaluationService) publishedTeams() map[string]bundle.IndexTeam {
	result := map[string]bundle.IndexTeam{}
	data, err := os.ReadFile(filepath.Join(e.publicDir, "index.json"))
	if err != nil {
		return result
	}
	var index bundle.Index
	if json.Unmarshal(data, &index) != nil {
		return result
	}
	for _, team := range index.Teams {
		result[team.TeamID] = team
	}
	return result
}

func (e *evaluationService) reportIsCurrent(id, builtAt string) bool {
	e.mu.RLock()
	state, started := e.states[id], e.started[id]
	e.mu.RUnlock()
	if state == "failed" {
		return false
	}
	if state != "running" || started.IsZero() {
		return true
	}
	publishedAt, err := time.Parse(time.RFC3339, builtAt)
	return err == nil && !publishedAt.Before(started.Truncate(time.Second))
}

func (e *evaluationService) partialTeam(id string) (bundle.Team, bool) {
	e.mu.RLock()
	jobID := e.jobIDs[id]
	state, started := e.states[id], e.started[id]
	e.mu.RUnlock()
	paths := []string{filepath.Join(e.publicDir, "teams", id+".json")}
	if safeJobID.MatchString(jobID) && jobID != "." && jobID != ".." {
		paths = append([]string{filepath.Join(filepath.Dir(e.publicDir), "runs", jobID, "teams", id+".json")}, paths...)
	}
	for _, path := range paths {
		if state == "running" {
			info, err := os.Stat(path)
			// Published report timestamps use RFC3339 second precision. Compare at
			// that same precision so filesystems with coarser mtimes do not make
			// a report written during this run look older than its start time.
			if err != nil || info.ModTime().Truncate(time.Second).Before(started.Truncate(time.Second)) {
				continue
			}
		}
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var team bundle.Team
		if json.Unmarshal(data, &team) == nil && team.TeamID == id && e.reportIsCurrent(id, team.BuiltAt) {
			return team, true
		}
	}
	if state == "running" && safeJobID.MatchString(jobID) {
		team, err := pipeline.ReadPartialTeam(filepath.Join(filepath.Dir(e.publicDir), "runs", jobID), id)
		if err == nil && e.reportIsCurrent(id, team.BuiltAt) {
			return team, true
		}
	}
	return bundle.Team{}, false
}

func (s *Server) liveIndex(w http.ResponseWriter, _ *http.Request) {
	registered, err := registry.Load(s.registryPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось прочитать реестр команд")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	index := bundle.Index{BundleSchema: bundle.SchemaVersion, BuiltAt: now, Meta: bundle.Meta{BundleSchema: bundle.SchemaVersion, BuiltAt: now, ReportSchema: "1.0", RubricVersions: []string{}, SkillVersions: []string{}, Models: []string{}}, Teams: []bundle.IndexTeam{}}
	published := map[string]bundle.IndexTeam{}
	if s.evaluation != nil {
		data, readErr := os.ReadFile(filepath.Join(s.evaluation.publicDir, "index.json"))
		if readErr == nil {
			var saved bundle.Index
			if json.Unmarshal(data, &saved) == nil && saved.BundleSchema == bundle.SchemaVersion {
				index.Meta, index.BuiltAt = saved.Meta, saved.BuiltAt
				for _, team := range saved.Teams {
					published[team.TeamID] = team
				}
			}
		}
	}
	for _, team := range registered.Teams {
		if !team.Active {
			continue
		}
		status := "no_data"
		if s.evaluation != nil {
			s.evaluation.mu.RLock()
			if state := s.evaluation.states[team.ID]; state != "" {
				status = state
			}
			s.evaluation.mu.RUnlock()
		}
		if status == "running" && s.evaluation != nil {
			if partial, ok := s.evaluation.partialTeam(team.ID); ok {
				areas := map[string]float64{}
				for name, area := range partial.Areas {
					if area.Status == "done" && area.Score != nil {
						areas[name] = *area.Score
					}
				}
				index.Teams = append(index.Teams, bundle.IndexTeam{TeamID: team.ID, Name: team.Name, Status: status, Areas: areas, Partial: len(areas) > 0})
				continue
			}
		}
		if saved, ok := published[team.ID]; ok && s.evaluation != nil && s.evaluation.reportIsCurrent(team.ID, index.BuiltAt) {
			saved.Name = team.Name
			if status == "running" {
				saved.Status = "running"
				saved.Total = nil
				saved.Rank = nil
				saved.Partial = true
			}
			index.Teams = append(index.Teams, saved)
			continue
		}
		index.Teams = append(index.Teams, bundle.IndexTeam{TeamID: team.ID, Name: team.Name, Status: status, Areas: map[string]float64{}, Partial: false})
	}
	sort.SliceStable(index.Teams, func(i, j int) bool {
		a, b := index.Teams[i], index.Teams[j]
		if a.Total == nil {
			return false
		}
		if b.Total == nil {
			return true
		}
		if *a.Total == *b.Total {
			return a.TeamID < b.TeamID
		}
		return *a.Total > *b.Total
	})
	for i := range index.Teams {
		if index.Teams[i].Total == nil {
			index.Teams[i].Rank = nil
			continue
		}
		rank := i + 1
		if i > 0 && index.Teams[i-1].Total != nil && *index.Teams[i-1].Total == *index.Teams[i].Total {
			rank = *index.Teams[i-1].Rank
		}
		index.Teams[i].Rank = &rank
	}
	writeJSON(w, http.StatusOK, index)
}

var safeTeamID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
var safeJobID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

func (s *Server) liveTeam(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !safeTeamID.MatchString(id) || s.evaluation == nil {
		writeError(w, http.StatusNotFound, "Оценка команды ещё не готова")
		return
	}
	registered, err := registry.Load(s.registryPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось прочитать реестр команд")
		return
	}
	found := false
	for _, team := range registered.Teams {
		if team.ID == id && team.Active {
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusNotFound, "Команда не найдена")
		return
	}
	saved, ok := s.evaluation.partialTeam(id)
	if !ok {
		writeError(w, http.StatusNotFound, "Оценка команды ещё не готова")
		return
	}
	for _, team := range registered.Teams {
		if team.ID == id {
			saved.Name = team.Name
			break
		}
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) liveStats(w http.ResponseWriter, _ *http.Request) {
	if s.evaluation == nil {
		writeError(w, http.StatusNotFound, "Статистика ещё не готова")
		return
	}
	data, err := os.ReadFile(filepath.Join(s.evaluation.publicDir, "stats.json"))
	if err != nil {
		writeError(w, http.StatusNotFound, "Статистика ещё не готова")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(data)
}
