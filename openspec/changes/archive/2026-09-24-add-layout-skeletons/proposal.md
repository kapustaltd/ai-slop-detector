# Add layout-matched loading skeletons

## Why

Several routes display plain loading text or a narrow loading bar while their content is pending.
The empty space does not communicate the structure that is about to appear and can make transitions
feel abrupt.

## What Changes

- Add a shared, accessible skeleton primitive with a CSS-only shimmer and reduced-motion support.
- Replace the leaderboard's blank loading branch with placeholders shaped like its header, controls,
  and results.
- Replace the team page's loading text with placeholders shaped like its header, score cards, and
  profile sections.
- Replace the team registry's loading bar with placeholder rows shaped like its table.
- Remove the standalone design-only skeleton page in favor of the real application layouts.

## Impact

- Affected routes: `/`, `/team/:teamId`, and `/manage/teams`.
- No data contract, route behavior, API, or dependency changes.
