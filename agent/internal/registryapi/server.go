package registryapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"

	"github.com/kapustaltd/ai-slop-detector/agent/internal/registry"
)

type Server struct {
	registryPath string
	writeMu      sync.Mutex
	evaluation   *evaluationService
}

func New(registryPath string) (*Server, error) {
	if _, err := registry.Load(registryPath); err != nil {
		return nil, err
	}
	return &Server{registryPath: registryPath}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/teams", s.listTeams)
	mux.HandleFunc("GET /api/bundle/index", s.liveIndex)
	mux.HandleFunc("GET /api/bundle/stats", s.liveStats)
	mux.HandleFunc("GET /api/bundle/teams/{id}", s.liveTeam)
	mux.HandleFunc("GET /api/evaluation/progress/{id}", s.liveProgress)
	mux.HandleFunc("POST /api/teams", s.createTeam)
	mux.HandleFunc("PUT /api/teams/{id}", s.updateTeam)
	mux.HandleFunc("DELETE /api/teams/{id}", s.deleteTeam)
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func (s *Server) listTeams(w http.ResponseWriter, _ *http.Request) {
	value, err := registry.Load(s.registryPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Не удалось прочитать реестр команд")
		return
	}
	writeJSON(w, http.StatusOK, value.Teams)
}

func (s *Server) createTeam(w http.ResponseWriter, r *http.Request) {
	var team registry.Team
	if err := decodeJSON(w, r, &team); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте поля команды")
		return
	}
	s.writeMu.Lock()
	err := registry.Add(s.registryPath, team)
	s.writeMu.Unlock()
	if err != nil {
		if errors.Is(err, registry.ErrTeamExists) {
			writeError(w, http.StatusConflict, "Команда с таким ID уже существует")
			return
		}
		writeError(w, http.StatusBadRequest, "Проверьте ID, название, URL и ветку")
		return
	}
	if s.evaluation != nil && team.Active {
		s.evaluation.enqueue(team.ID)
	}
	writeJSON(w, http.StatusCreated, team)
}

func (s *Server) updateTeam(w http.ResponseWriter, r *http.Request) {
	id, err := url.PathUnescape(r.PathValue("id"))
	if err != nil || id == "" {
		writeError(w, http.StatusBadRequest, "Некорректный ID команды")
		return
	}
	var team registry.Team
	if err := decodeJSON(w, r, &team); err != nil {
		writeError(w, http.StatusBadRequest, "Проверьте поля команды")
		return
	}
	if team.ID != "" && team.ID != id {
		writeError(w, http.StatusBadRequest, "ID команды нельзя изменить")
		return
	}
	team.ID = id
	s.writeMu.Lock()
	err = registry.Update(s.registryPath, id, team)
	s.writeMu.Unlock()
	if err != nil {
		writeRegistryError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, team)
}

func (s *Server) deleteTeam(w http.ResponseWriter, r *http.Request) {
	id, err := url.PathUnescape(r.PathValue("id"))
	if err != nil || id == "" {
		writeError(w, http.StatusBadRequest, "Некорректный ID команды")
		return
	}
	s.writeMu.Lock()
	err = registry.Remove(s.registryPath, id)
	s.writeMu.Unlock()
	if err != nil {
		writeRegistryError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func writeRegistryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, registry.ErrTeamNotFound):
		writeError(w, http.StatusNotFound, "Команда не найдена")
	case errors.Is(err, registry.ErrTeamExists):
		writeError(w, http.StatusConflict, "Команда с таким ID уже существует")
	case errors.Is(err, registry.ErrLastTeam):
		writeError(w, http.StatusConflict, "В реестре должна остаться хотя бы одна команда")
	default:
		writeError(w, http.StatusBadRequest, "Не удалось сохранить изменения команды")
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		return fmt.Errorf("unexpected trailing JSON: %v", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
