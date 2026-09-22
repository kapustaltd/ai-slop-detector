# Architecture review agent

The `slop-agent` CLI sends a bounded, redacted repository snapshot to an
OpenAI-compatible chat endpoint and accepts only a validated JSON report.

It never runs code from the analyzed repository. The repository path is used
for reading files and for `git rev-parse HEAD` only.

## Local run

```sh
export AGENT_BASE_URL=https://ru.cheapvibecode.ru/v1
export AGENT_API_KEY='set-outside-the-repository'
export AGENT_MODEL=gpt-5.6-luna
export AGENT_EFFORT=none

go run ./cmd/slop-agent \
  --repo .. \
  --repo-id ai-slop-detector \
  --area backend \
  --rubric ../rubrics/backend.v1.yaml \
  --output /tmp/ai-slop-report.json
```

The rubric must expose leaf metric IDs under `metrics:` blocks. The canonical
backend/frontend rubrics will be added with the evaluation-contract feature;
the runtime deliberately does not hard-code metric names.

## Web runner

The controlled web runner exposes `GET /healthz`, `POST /api/v1/runs`,
`GET /api/v1/runs/<id>` and the public read-only bundle under `GET /api/v1/bundle/`.
It accepts repository metadata only; it never accepts
or executes arbitrary shell text from HTTP requests.

```sh
go run ./cmd/web-runner \
  --addr 127.0.0.1:8080 \
  --rubrics-dir ../rubrics \
  --data-dir /tmp/ai-slop-detector-web-runner
```

The web runner is intentionally exposed without an operator token: requests from
`/#/run` are anonymous and the page polls the run status without credentials. A
successful run is merged into the persistent public bundle and becomes visible in
the leaderboard automatically.

## Tests

```sh
go test ./...
```
