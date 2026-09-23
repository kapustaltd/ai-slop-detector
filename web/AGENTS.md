# Web application

Static React app using Feature-Sliced Design. Layers import only downward:
`shared → entities → widgets → pages → app`; access another slice through its `index.ts` only.

- Bundle access goes through `src/shared/api/bundle.ts`; generated types live under
  `src/shared/api/generated/` and must not be edited manually.
- The UI renders precomputed scores and aggregates; it never recalculates or edits them.
- Use design tokens from `src/app/styles/globals.css` and references under `design/reference/`.
  No literal colors or font sizes in markup. Both themes and 360 px width are required.
- Keep constants and mappings in a slice's `model/`, not component files under `ui/`.
- No runtime network requests. UI text is Russian; tests query by role/text rather than CSS class.
- Focused checks during work; run `npm run check` before proposing a commit.
