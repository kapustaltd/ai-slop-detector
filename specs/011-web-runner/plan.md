# Plan: Web runner

## Constitution Check

- Scores, rankings and published bundle remain immutable from the UI; this feature only creates a
  new run artifact and therefore preserves Principle V.
- Repository content remains untrusted data and is analyzed by the existing isolated pipeline;
  the API never executes request-provided shell text.
- The new API is contract-first and does not change the evaluation report schema.
- Secrets stay in environment variables; the browser receives only a short-lived operator token
  supplied by the operator and never receives provider credentials.
- Tests cover the new API and UI states before the feature is complete.

## Architecture

```text
React /run page
       │ same-origin /api/v1
       ▼
Go web-runner (cmd/web-runner)
       │ bounded job manager
       ▼
existing internal/pipeline + CommandProvider
       │
filesystem run state + raw pipeline output
```

The Go service is a control plane, not a general command proxy. It constructs a validated in-memory
registry entry and calls `pipeline.Pipeline.Run`. The static frontend remains deployable without the
service and reports an unavailable API state.

## Implementation Steps

1. Add spec, constitutional clarification and developer documentation for the controlled operation.
2. Add an internal Go web API with validation, authentication, bounded worker, filesystem job state,
   status endpoint and tests.
3. Add a React runner page, API client, route, navigation link and interaction tests.
4. Add local proxy/configuration and production service/reverse-proxy instructions.
5. Run Go tests, frontend quality checks and deployment script checks; commit each completed step.
