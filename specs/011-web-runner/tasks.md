# Tasks: Web runner

## Step 1 — Contract and policy

- [x] Add `011-web-runner/spec.md`, `plan.md` and this task list.
- [x] Amend the read-only wording so only evaluation data is immutable while controlled run creation
  is allowed.
- [x] Document local and production environment variables.

## Step 2 — Go control plane

- [x] Implement request validation and API envelopes.
- [x] Implement token authentication and active-job limit.
- [x] Implement asynchronous runner job lifecycle and bounded logs.
- [x] Persist job metadata and expose `GET /healthz`, `POST /api/v1/runs` and `GET /api/v1/runs/{id}`.
- [x] Add unit/HTTP tests for validation, auth, queue limit and terminal states.

## Step 3 — Web interface

- [x] Add runner API client and generated-free API DTOs local to the control-plane client.
- [x] Add `/run` page with safe form, command preview, status polling and failure state.
- [x] Add navigation from the leaderboard and tests for submit/loading/error/success states.
- [x] Add Vite development proxy and unavailable API copy.

## Step 4 — Operations

- [x] Add systemd service example and Nginx `/api/` reverse-proxy configuration.
- [x] Add production environment and token setup instructions.
- [x] Run all checks, update status to Implemented, commit and push.
