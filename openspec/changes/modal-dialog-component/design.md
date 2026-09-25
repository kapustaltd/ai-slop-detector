# Design: accessible modal component

Use a shared `ModalOverlay` React component that portals overlay markup to `document.body`. A single
`Modal` class instance per mounted overlay handles open and close transitions, declarative triggers,
focus trapping, focus restoration, Escape, backdrop pointer behavior, custom events, and the shared
stack and scroll-lock counter. React owns the markup; the controller owns only modal lifecycle
attributes and classes.

The showcase uses the application's React, TypeScript, and Tailwind setup, with local component CSS
for the supplied premium dark dialog visual. It introduces no dependency. Dialog content remains
ordinary JSX and form data is read through `FormData`; status messages use `textContent`.

Focusable controls are recalculated on each Tab key. Scroll styles are saved with their inline CSS
priorities and restored when the last dialog closes. Reduced-motion users skip transitions and
shimmer-like movement entirely.
