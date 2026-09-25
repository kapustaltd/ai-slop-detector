# Add an accessible reusable modal component

## Why

The application needs a reusable dialog pattern for focused forms and destructive confirmations,
with reliable keyboard behavior, focus restoration, and scroll locking.

## What Changes

- Add a shared React modal overlay backed by one TypeScript controller class for all dialogs.
- Support declarative `data-md-open` and `data-md-close` controls, Escape, backdrop dismissal, and
  stacked-dialog behavior.
- Add a modal showcase route with an invite form and a destructive project confirmation.
- Add motion-aware styling with visible cyan focus rings and a reduced-motion mode.

## Impact

- Affected routes: `/modal-demo`.
- No new runtime dependencies or API changes.
