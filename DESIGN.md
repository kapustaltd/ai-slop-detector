# Design system

This file is the source of truth for the web interface. Every page, component and state uses the
tokens below; new one-off colors, font sizes, spacing values or corner radii should not be added
without updating this document first.

## Product promise

Проверка проектов показывает порядок команд по качеству кода репозитория. Идея, демо и защита не
оцениваются. Each page has one clear next action, visible feedback for every interaction, and a
complete loading, empty and error state.

## Visual language

- **Palette:** near-black blue-slate surfaces, graphite text, and one electric cyan action color.
  The selected-team panel and score use cyan-tinted surfaces to establish the focal region. Red is
  reserved for critical findings and failed evaluation; sand is used for warnings. Score colors use
  one blue tone with lightness as the only scale.
- **Typography:** Geist Variable, 400 for body, 500 for headings and controls, 600 only for the
  active label. Body text is 15px with generous line-height; metadata is 13.5px and never carries
  essential meaning alone. Numbers use tabular figures.
- **Shape:** 8px controls, 10px panels, 12px cards, 6px badges. Nested surfaces use a larger
  outside radius than the inside control.
- **Spacing:** 4px base rhythm. Page padding is 16px on small screens and 24px from `sm`; section
  gaps are 16px or 18px. Touch controls are at least 44px high.
- **Elevation:** borders communicate structure; shadows are reserved for sheets and dialogs. No
  decorative gradients, noisy shadows or arbitrary rounded values.

## Tokens

The canonical values live in `web/src/app/styles/globals.css` as `--ds-*` variables. Components
consume semantic aliases such as `bg-bg`, `bg-surface`, `text-fg-muted`, `border-line` and
`rounded-control` rather than hard-coding values.

Core type sizes are 30px/500 for page titles, 26px/500 for section titles, 22px/300 for counts,
17px for lead copy, 16px/500 for strong labels, 15px for body copy, 14.5px for prose and metadata,
and 12.5px/500 for overlines. Core radii are 6px badges, 8px controls, 10px panels and 12px
cards. Controls are 36px on desktop, 44px on touch screens, and compact controls are 30px only
when they are not the sole way to perform an action.

| Purpose | Light | Dark |
| --- | --- | --- |
| Background | `#fbfbfc` | `#08090a` |
| Surface | `#ffffff` | `#161719` |
| Muted surface | `#f3f4f7` | `#1d1e21` |
| Text | `#14161a` | `#eceef2` |
| Muted text | `#565c6b` | `#a0a7b4` |
| Border | `#e4e6eb` | `#272c34` |
| Primary | `#5b5bd6` | `#55c2ff` |

## Interaction states

Every button and link has a hover surface or color change, a 150ms transition, a `scale(0.96)`
pressed state, a disabled state where applicable, and a visible 2px keyboard focus ring. Motion is
removed under `prefers-reduced-motion`. Modals close with Escape, trap focus while open and return
focus to their trigger.

## Responsive contract

The layout reflows at 360px without horizontal scrolling. Desktop navigation becomes an explicit
mobile menu, tables become cards, and all controls remain at least 44px high. Text may grow to 200%
without clipping or changing the reading order.

## Page contract

Each route has a unique document title, a meta description and the shared favicon. The home page
states what the product does in one line. A page's primary action is visually strongest and appears
once in the header or first meaningful state. Placeholder copy is not product copy: labels explain
the field, and empty/error states explain the next step.
