# Tasks: Непрерывный ход оценки

**Input**: Design documents from `/specs/016-progressive-evaluation-trace/`

**Prerequisites**: `plan.md`, `spec.md`, `data-model.md`, `contracts/evaluation-progress.md`

## Phase 1: Operational progress contract

**Purpose**: Define and generate the shared contract without changing the evaluation report.

- [x] T001 [P] Extend `web/scripts/contract.mjs` to generate/check Go and TypeScript progress types from `schemas/evaluation-progress.schema.json`.
- [x] T002 Add valid/invalid progress fixtures; test the 20-event bound and ensure only verified source links enter the trace.
- [x] T003 Generate `agent/internal/contract/evaluation_progress.gen.go` and `web/src/shared/api/generated/evaluation-progress.ts`; use generated types in `web/src/shared/api/registry.ts`.

## Phase 2: User Story 1 - Следить за ходом оценки (Priority: P1)

**Goal**: Publish and restore verified progress events and partial findings for the active run.

**Independent Test**: A pipeline run writes scan/stage/area events and verified finding events to the run directory; the progress endpoint returns them after a page reload and ignores an earlier run's snapshot.

### Tests for User Story 1

- [x] T004 [P] [US1] Add pipeline tests for scan counts, verified finding events, event cap, and atomic progress snapshots in `agent/internal/pipeline/pipeline_test.go` and `progress_test.go`.
- [x] T005 [P] [US1] Add registry API tests for run-scoped progress reads, stale snapshot rejection, legacy fallback and status merge in `agent/internal/registryapi/evaluation_test.go`.

### Implementation for User Story 1

- [x] T006 [US1] Implement a mutex-protected progress recorder and atomic snapshot writer in `agent/internal/pipeline/progress.go`.
- [x] T007 [US1] Emit truthful preparation, area, scan, report and verified finding events from `agent/internal/pipeline/pipeline.go`; keep no more than 20 events and never serialize raw provider data.
- [x] T008 [US1] Merge the active job's snapshot with coarse in-memory status in `agent/internal/registryapi/evaluation.go`; retain the current-job path and legacy behavior.
- [x] T009 [US1] Return stable area and event data from `GET /api/evaluation/progress/{id}`; ignore malformed or stale snapshots without replacing a newer coarse status.

## Phase 3: User Story 2 - Понимать структуру и частичный отчёт (Priority: P1)

**Goal**: Keep the assessment page informative before the first area report and progressively replace skeletons with real results.

**Independent Test**: Render running progress with no team bundle, then publish one partial area; the rubric skeleton is shown first and only that area's real report replaces it.

### Tests for User Story 2

- [x] T010 [P] [US2] Add progress widget tests for event observations, source references, rubric statuses, and accessible labels in `web/src/widgets/evaluation-progress/ui/evaluation-progress-view.test.tsx`.
- [x] T011 [P] [US2] Extend team page tests for restored progress, empty-running skeleton, one ready/one active area, report transition, and retained content after polling failure in `web/src/pages/team/ui/team-page.test.tsx`.

### Implementation for User Story 2

- [x] T012 [US2] Implement shared progress/trace view and rubric skeleton in `web/src/widgets/evaluation-progress/` using generated progress and rubric types.
- [x] T013 [US2] Update `TeamPage` to fetch live progress and rubrics while `loadTeam` has no partial data, render trace/skeleton, and progressively display published areas in `web/src/pages/team/ui/team-page.tsx`.
- [x] T014 [US2] Reuse the shared trace on the team management progress card, change its running link label to «Смотреть ход оценки», and cover running/completed labels in `web/src/pages/team-management/ui/team-management-page.test.tsx`.

## Phase 4: User Story 3 - Перейти к живой оценке из рейтинга (Priority: P1)

**Goal**: Make running status a direct path into the live trace and completed status a direct path to the report.

**Independent Test**: Activate a running status in desktop table/mobile card, confirm it opens the team page, then change the status to done and confirm «Открыть отчёт» is presented.

### Tests for User Story 3

- [x] T015 [P] [US3] Extend leaderboard tests for running status actions in desktop table and mobile card, plus completed CTA labels in `web/src/widgets/leaderboard-table/ui/leaderboard-table.test.tsx` and `web/src/widgets/leaderboard-table/ui/leaderboard-row-card.test.tsx`.

### Implementation for User Story 3

- [x] T016 [US3] Make the running status action clickable in `web/src/widgets/leaderboard-table/ui/leaderboard-table.tsx` and `web/src/widgets/leaderboard-table/ui/leaderboard-row-card.tsx`.
## Phase 5: Polish and validation

**Purpose**: Confirm the contract, accessibility, partial data behavior and existing flows.

- [x] T017 [P] Review responsive layout, theme tokens, reduced-motion behavior and semantic keyboard-accessible links/regions in the shared trace.
- [x] T018 Run generated contract check, focused Go/Vitest tests, `go test ./...`, and `npm run check`.
- [x] T019 Review event payloads for secrets, raw provider text, unverified source paths and stale-run leakage; fix violations.
