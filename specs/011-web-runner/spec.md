# Feature Specification: Web runner для безопасного запуска оценки

**Feature Branch**: `011-web-runner`

**Created**: 2026-09-22

**Status**: Implemented

## Overview

Добавить в web-интерфейс страницу запуска оценки репозитория. Пользователь не вводит произвольную
команду shell: форма принимает только URL поддерживаемого Git-репозитория, ветку, идентификатор
команды и область оценки. Go control plane валидирует запрос, создаёт job и запускает существующий
pipeline с фиксированной конфигурацией.

Статический dashboard остаётся источником только для чтения итоговых оценок. Web runner создаёт
новый артефакт прогона и показывает его статус, но не редактирует баллы, места или уже опубликованный
дата-бандл.

## User Stories

### User Story 1 — Запустить оценку из браузера

Оператор открывает страницу «Новый прогон», вводит HTTPS URL репозитория, ветку, ID команды и
область (`backend`, `frontend` или `both`), после чего получает подтверждение с ID прогона.

### User Story 2 — Наблюдать за прогоном

Оператор открывает страницу прогона и видит состояния `queued`, `running`, `succeeded` или `failed`,
время запуска, прогресс по областям, последние безопасные сообщения и итог pipeline.

### User Story 3 — Не дать web-форме стать shell-доступом

Сервис принимает только allowlisted поля, проверяет URL хостинга, ветку и ID, требует Bearer-токен
в production, ограничивает число активных прогонов и никогда не передаёт пользовательскую строку
как команду или аргумент shell.

## API Contract

Base path: `/api/v1`.

### `GET /healthz`

Возвращает `200` без авторизации:

```json
{"data":{"status":"ok"}}
```

### `POST /api/v1/runs`

В production требует `Authorization: Bearer <WEB_RUNNER_TOKEN>` и возвращает `202 Accepted`.

Request:

```json
{
  "repository_url": "https://github.com/example/team-01.git",
  "repository_id": "team-01",
  "branch": "main",
  "area": "both"
}
```

`area` MUST be one of `backend`, `frontend`, `both`. URL MUST use HTTPS and an allowlisted host
(`github.com`, `gitlab.com` or `gitverse.ru`), MUST NOT contain credentials, query or fragment.

Response:

```json
{
  "data": {
    "id": "20260922T120000000Z-abc123",
    "status": "queued",
    "repository_id": "team-01",
    "area": "both",
    "created_at": "2026-09-22T12:00:00Z"
  }
}
```

The response MUST include a `Location: /api/v1/runs/<id>` header. Invalid JSON or fields return
`400`; missing/invalid token returns `401`; an active-job limit returns `429`.

### `GET /api/v1/runs/{id}`

Returns `200` with the job resource. Unknown IDs return `404`. The response includes status, timestamps,
area progress, bounded log lines, and a summary when the pipeline finishes. Internal paths, secrets,
raw prompts and provider output MUST NOT be returned.

## Requirements

- **FR-001**: Web MUST expose a Russian-language page for creating a controlled evaluation run.
- **FR-002**: Web MUST expose the created run ID and a status view with polling until a terminal state.
- **FR-003**: API MUST use versioned REST paths and the response/error envelopes defined above.
- **FR-004**: API MUST validate repository ID, branch, area and supported HTTPS host before enqueueing.
- **FR-005**: API MUST invoke the existing Go pipeline directly with a fixed provider binary and
  environment configuration; it MUST NOT execute a command received from the request.
- **FR-006**: Production API MUST require `WEB_RUNNER_TOKEN`; local development MAY allow an empty token.
- **FR-007**: API MUST allow at most one active job by default and return `429` while the limit is full.
- **FR-008**: Job state MUST be persisted under a configurable data directory so a status request can
  survive the worker finishing; retention MUST be bounded.
- **FR-009**: Logs shown in the UI MUST be bounded and sanitized; credentials and raw provider output
  MUST never be stored in the web job log.
- **FR-010**: Frontend MUST use `/api/v1` by default and support a Vite proxy for local development.
- **FR-011**: Existing leaderboard/team pages MUST remain read-only; the runner MUST NOT mutate the
  published static bundle.
- **FR-012**: API unit/contract tests and frontend interaction tests MUST cover validation, auth,
  queue limit, success and failure states.

## Non-goals

- Arbitrary shell command execution from a browser.
- User accounts, roles and multi-tenant authorization beyond one operator token.
- Editing scores, rankings, rubrics or the published data bundle from the UI.
- Streaming raw model prompts or model responses to the browser.
- Automatic deployment of a newly generated bundle to the public leaderboard.

## Acceptance Criteria

- `POST /api/v1/runs` rejects unsupported hosts, credentials in URLs, invalid branches and unknown
  areas without starting a process.
- A valid request returns `202` and can be observed via `GET /api/v1/runs/{id}`.
- A second request while the configured active-job limit is full returns `429`.
- The frontend can create a run, display the ID, poll status and render a sanitized failure.
- `go test ./...` and `npm run check` pass.
- The public static dashboard continues to build without a backend configured; only the runner page
  displays an unavailable-state message when `/api/v1` is absent.
