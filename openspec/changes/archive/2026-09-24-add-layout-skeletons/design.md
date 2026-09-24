# Design: layout-matched loading skeletons

## Approach

Use a small `Skeleton` component in `shared/ui` for the base placeholder shape. The shimmer is a
single pseudo-element animation defined in the app's existing global stylesheet. Theme values use
the existing light/dark design tokens, with a separate shimmer value for each theme. The component
marks every placeholder `aria-hidden`; each page-level loading region owns `aria-busy="true"` and a
localized accessible label.

Each page keeps its own layout composition in its page slice:

- Leaderboard: title and metadata header, toolbar, desktop result table, and mobile result cards.
- Team: breadcrumb/header, overall and area score cards, and two profile section cards.
- Registry management: column header and table-like rows using the existing five-column structure.

Loading placeholders are static in reduced-motion mode. The shimmer uses CSS only and introduces no
runtime dependency.

## Decisions

- Keep the current route-level loading conditions and data flow unchanged.
- Use the app's CSS variables and Tailwind utilities so placeholders match both app themes.
- Keep the animation in global CSS because one keyframe definition serves all routes and variants.
- Keep the standalone HTML mock out of the deliverable; actual route skeletons are the source of
  truth.

## Risks

- Skeleton dimensions can drift from their real layouts as pages evolve. Keep compositions adjacent
  to each page and mirror the existing responsive breakpoints and major sections.
