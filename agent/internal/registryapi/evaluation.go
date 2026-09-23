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
	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

type TeamEvaluator interface {
	Evaluate(context.Context, registry.Team) error
}

type evaluationService struct {
	registryPath, publicDir string
	budgetPath              string
	evaluator               TeamEvaluator
	queue                   chan string
	mu                      sync.RWMutex
	states                  map[string]string
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
	e := &evaluationService{registryPath: s.registryPath, publicDir: publicDir, budgetPath: filepath.Join(filepath.Dir(publicDir), "evaluation-budget.json"), evaluator: evaluator, queue: make(chan string, 32), states: map[string]string{}, started: map[string]time.Time{}, limit: dailyLimit}
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

func (e *evaluationService) enqueue(id string) {
	if e.evaluator == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.states[id] == "running" {
		return
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
		return
	}
	e.started[id] = time.Now().UTC()
	data, err := json.Marshal(e.started)
	if err != nil {
		e.states[id] = "failed"
		return
	}
	temp, err := os.CreateTemp(filepath.Dir(e.budgetPath), ".evaluation-budget-")
	if err != nil {
		e.states[id] = "failed"
		return
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
		return
	}
	e.states[id] = "running"
	e.queue <- id
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
					err = e.evaluator.Evaluate(ctx, team)
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
			log.Printf("evaluation team=%s failed: %v", id, err)
		} else {
			delete(e.states, id)
		}
		e.mu.Unlock()
	}
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
		if saved, ok := published[team.ID]; ok && saved.Status == "done" {
			saved.Name = team.Name
			index.Teams = append(index.Teams, saved)
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
	data, err := os.ReadFile(filepath.Join(s.evaluation.publicDir, "teams", id+".json"))
	if err != nil {
		writeError(w, http.StatusNotFound, "Оценка команды ещё не готова")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(data)
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
