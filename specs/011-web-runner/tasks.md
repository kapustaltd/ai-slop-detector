# Tasks: Web runner

## Step 1 — Contract and policy

- [ ] Add `011-web-runner/spec.md`, `plan.md` and this task list.
- [ ] Amend the read-only wording so only evaluation data is immutable while controlled run creation
  is allowed.
- [ ] Document local and production environment variables.

## Step 2 — Go control plane

- [ ] Implement request validation and API envelopes.
- [ ] Implement token authentication and active-job limit.
- [ ] Implement asynchronous runner job lifecycle and bounded logs.
- [ ] Persist job metadata and expose `GET /healthz`, `POST /api/v1/runs` and `GET /api/v1/runs/{id}`.
- [ ] Add unit/HTTP tests for validation, auth, queue limit and terminal states.

## Step 3 — Web interface

- [ ] Add runner API client and generated-free API DTOs local to the control-plane client.
- [ ] Add `/run` page with safe form, command preview, status polling and failure state.
- [ ] Add navigation from the leaderboard and tests for submit/loading/error/success states.
- [ ] Add Vite development proxy and unavailable API copy.

## Step 4 — Operations

- [ ] Add systemd service example and Nginx `/api/` reverse-proxy configuration.
- [ ] Add production environment and token setup instructions.
- [ ] Run all checks, update status to Implemented, commit and push.
