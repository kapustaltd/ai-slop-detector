# Live evaluation after team registration

## Problem

`POST /api/teams` changes the server registry, while the leaderboard imports `web/data/index.json` at build time. A newly registered team is invisible until a separate evaluation, bundle copy and frontend rebuild. The registration UI currently implies more progress than it performs.

## Contract

- When the registry API is reachable, the leaderboard loads its index from the API and refreshes it while the page is open. Registered active teams appear immediately with a truthful pending, running, failed or completed state. Without the API, the existing static bundle remains the fallback.
- The registry API serves a live index and completed team bundles. The live index contains only teams from the current registry; pending rows have no score or rank.
- A configured bridge queues each newly registered active team, submits it to the existing authenticated web runner and observes its job state. The runner publishes the completed bundle atomically; the frontend reads it without a rebuild.
- The worker has one active run, a bounded queue and a configurable daily submission limit. Anonymous registration must not create unlimited model spend. A missing worker configuration is shown as `no_data` and never described as processing.
- Registration success, queue state, evaluation failure and publication failure are distinct. A failed evaluation does not produce a fake score.
- A completed row links to its team page. Pending and failed rows show their status without a broken detail link.
- A failed row exposes «Повторить анализ» in its actions menu. The action starts a new evaluation for
  that team and immediately returns the row to the running state; it is unavailable for other states.
- A running team with an already published area can open that available report. The page refreshes
  while evaluation continues and never presents unfinished areas as scored.
- The pipeline writes an atomic partial team file after each area finishes. The live API reads it
  from the current runner job's output directory under the same data root as its public bundle.
  For older deployed runners, the API reconstructs the available area from the job's saved state.
  An older file from a previous run is ignored until this run publishes a new one.
- Existing static fixture pages and tests continue to work when the API is absent.

## Verification

- API test: create team -> pending/running index -> successful published score; failed evaluation -> failed row.
- Web test: live index supersedes static fixtures, pending team appears, polling updates to completed row.
- API and web tests: a failed evaluation can be queued again from the row actions menu.
- Go and web quality gates pass.
