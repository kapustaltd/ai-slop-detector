# Add dark gamified leaderboard dashboard

## Why

The current hackathon interface presents evaluation data as a conventional administration view.
The product would be easier to scan and more distinctive if the leaderboard used a compact dark
dashboard language: a minimal app header, elevated widget panels, prominent scores, status pills,
and a focused team summary. The visual direction should borrow the information architecture of a
game HUD without copying gambling semantics or changing the evaluation model.

## What Changes

- Add a dark gamified dashboard visual system for the leaderboard and team-facing result views.
- Recompose the leaderboard around a minimal app header, a central selected-team score panel, and a
  full-width ranking table.
- Replace the primary leaderboard table presentation with dense, scannable team cards/rows while
  preserving rank, score, area scores, status, warnings, sorting, and filtering behavior.
- Add a score-ring presentation for the selected team's existing aggregate score and compact
  criterion markers for the available score areas.
- Add shared dark dashboard tokens for surfaces, borders, typography, radii, accent, and semantic
  states, while retaining the existing light theme and project token source of truth.
- Define responsive, keyboard-accessible, and reduced-motion behavior for the new dashboard layout.
- Align the team registry and not-found surfaces with the same shell, panels, actions, and state
  hierarchy while keeping registry operations unchanged.

## Impact

- Affected routes: `/`, `/team/:teamId`, `/manage/teams`, and the not-found route.
- No changes to the evaluation contract, data bundle, ranking calculations, API, or write behavior.
- No new runtime dependencies.
