# Design: dark gamified leaderboard dashboard

## Direction

Use the visual language of a dark gaming HUD and compact bento dashboard: near-black canvas,
slightly elevated matte surfaces, low-contrast borders, generous panel radii, compact typography,
large score numerals, pills, badges, and one bright accent. The result should feel like a
hackathon control room, not a casino or a marketing landing page.

Do not copy roulette, gifts, gambling terminology, reward mechanics, casino animation, or literal
game iconography. The central visual is a score gauge, and the lower content is the existing team
ranking and evaluation evidence.

## Layout

At desktop widths, use a minimal application shell:

- A compact top app header with the product mark and theme control. No sidebar or placeholder
  navigation is shown; the leaderboard is the product's primary workspace.
- A fluid main region containing the selected-team score panel, rank/leader gap summary cards, and
  the full-width ranking grid/list.
- No separate activity region. Evaluation results, statuses, warnings, and links remain in the
  ranking table and team detail route.

The selected team panel should show the existing team name, repository label, aggregate score, rank,
and available area scores. The current bundle does not contain a project display name, so the UI must
not invent one. Render the aggregate as an SVG or CSS score ring with a visible text fallback;
the ring is a visualization of the value already present in the bundle, not a new calculation.
Criterion labels such as `IDEA`, `CODE`, `UX`, `IMPACT`, and `PITCH` may be used only when they map
to existing rubric areas or are clearly presented as unavailable. Do not invent metrics.

The ranking content should use dense cards or rows rather than a visually heavy admin table. Every
entry still exposes rank, team, project, aggregate score, status, warning indicators, and the
existing area scores. The first three ranks may receive restrained surface or accent treatment, but
must not rely on color alone.

## Visual tokens

Use the existing `design/reference/tokens.json` as the source of truth. If the change needs new
values, add them there before consuming them in components. The intended dark-theme relationships
are:

```text
canvas       #08090a
sidebar      #0d0e10
surface      #161719
surface-up   #1d1e21
surface-hot  #25262a
border       rgba(255, 255, 255, 0.055)
text         #f3f3f3
secondary    #9a9ca2
muted        #62646a
accent       #55c2ff
success      #58d68d
danger       #ff6b6b
```

These values describe the intended contrast hierarchy, not permission to bypass the token file.
Use 10–22px radii according to component size, 8–12px layout gaps, and 14–18px panel padding.
Panels use a subtle border and at most a restrained shadow; depth comes primarily from adjacent
surface values. Buttons are pill-shaped with a minimum visual height of 44px for primary actions.

Use Inter, Geist, or the existing project grotesk stack. Keep body text compact, use balanced
headings, and reserve the largest type for the score and rank. Do not make all text uppercase or
reduce supporting text below the project's accessibility-approved minimum.

## Interaction and accessibility

- Preserve the existing routes, links, sorting, filtering, status meanings, and read-only behavior.
- A team card/row is keyboard reachable and has a clear focus ring; clicking or pressing Enter opens
  the same team route as the current row.
- The score ring has an accessible name and exposes the numeric score as text. Decorative ticks and
  gradients are hidden from assistive technology.
- Status, rank movement, warnings, and semantic colors are always paired with text or an icon label.
- The top app header remains compact and reachable on narrow screens; no hidden navigation drawer is
  required.
- The layout remains usable from 360px wide. No horizontal scrolling is required for primary team
  identity, rank, score, and status.
- Honor `prefers-reduced-motion: reduce`: disable score-ring animation, hover movement, shimmer, and
  route transition motion while retaining static focus and selected states.
- Keep contrast and focus behavior from the existing design system. Record any deliberate deviation
  in `docs/design-deviations.md`.

## Data and state behavior

The redesign consumes the existing bundle values and must not calculate aggregate scores, ranks, or
new criterion values in the browser. Loading, empty, partial, failed, and error states retain their
current semantics and receive equivalent dashboard-shaped presentations.

The team registry keeps its current edit, delete, retry, and repository-entry workflows. Its table
is presented as a dashboard panel with the same surface, action, focus, and status treatment. The
not-found route uses the same page header and a single recovery panel. The isolated modal showcase
is intentionally outside this change because it is a component demonstration rather than a product
route.

## Risks

- A denser card layout can hide secondary columns. Keep the existing details available through the
  team route and responsive expansion, and test long team/project names.
- A score ring can be mistaken for a computed value. Always show the source numeric score and avoid
  client-side rounding that changes the displayed contract value.
- A `LIVE` label would contradict the static bundle model. Use `ЛЕНТА` or `СОБЫТИЯ` unless a future
  spec explicitly adds a realtime source.
