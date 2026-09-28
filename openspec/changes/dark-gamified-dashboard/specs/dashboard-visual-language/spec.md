# Dashboard visual language

## ADDED Requirements

### Requirement: Product routes share the dashboard shell

Product routes MUST use the shared dashboard shell and visual tokens while preserving their own
workflow semantics.

#### Scenario: A user opens team management

- **WHEN** the registry API is available and the user opens `/manage/teams`
- **THEN** the page uses the dashboard header, primary action, panel surfaces, table hierarchy, and
  focus states
- **AND** add, edit, delete, retry, loading, error, and progress behavior remains unchanged

#### Scenario: A user opens an unknown route

- **WHEN** no route matches the current URL
- **THEN** the page shows a dashboard-styled not-found panel with a clear recovery link to the rating
- **AND** it does not expose fake navigation or pretend that the missing route has loaded

### Requirement: The leaderboard presents a compact hackathon control room

The web application MUST present the leaderboard as a dark dashboard with a minimal app header and
an information-dense full-width primary region.

#### Scenario: A user opens the leaderboard on desktop

- **WHEN** the leaderboard has loaded a data bundle
- **THEN** the page shows a compact app header, a selected-team summary, and full-width ranking
  content
- **AND** the layout uses elevated panels, low-contrast borders, compact spacing, and a single
  primary accent
- **AND** no gambling terminology, reward mechanics, roulette, or gift semantics are used

#### Scenario: A user opens the leaderboard on a narrow screen

- **WHEN** the viewport is 360px wide or wider
- **THEN** the primary team identity, rank, aggregate score, and status remain readable without
  horizontal scrolling
- **AND** the primary ranking content remains readable without a navigation drawer

### Requirement: Existing ranking data remains visible and authoritative

The dashboard MUST preserve the existing leaderboard data and read-only behavior while changing its
presentation.

#### Scenario: A ranked team is displayed as a card or row

- **WHEN** a team has rank, aggregate score, area scores, status, or warnings in the bundle
- **THEN** the corresponding values remain visible or are available through the team detail route
- **AND** the UI does not calculate or replace ranks, aggregates, or missing values in the browser

#### Scenario: A user selects a team

- **WHEN** the user clicks or keyboard-activates a team card or row
- **THEN** the application navigates to the same team route as the current leaderboard
- **AND** sorting, filtering, status, warning, and deep-link behavior remains unchanged

### Requirement: The selected-team summary visualizes the existing score

The team summary MUST show the selected team's existing identity and aggregate score in a prominent
score panel with an accessible gauge presentation.

#### Scenario: A selected team has an aggregate score

- **WHEN** the selected team has an aggregate score in the bundle
- **THEN** the panel shows the team name, a truthful repository label, numeric score, rank, and
  available area scores
- **AND** a score ring or equivalent gauge visualizes that same value without introducing a new
  calculation

#### Scenario: The selected team has incomplete or failed data

- **WHEN** the selected team is partial, pending, missing, or failed
- **THEN** the panel communicates that state using the existing status semantics
- **AND** it does not render missing scores as zero

### Requirement: Dashboard interaction is accessible and motion-aware

The dashboard MUST preserve usable keyboard, focus, contrast, and reduced-motion behavior.

#### Scenario: A user navigates with a keyboard

- **WHEN** the user tabs through the app header, controls, team cards, and table content
- **THEN** every interactive element has a visible focus indicator and a logical order
- **AND** team cards expose the same activation behavior as their links

#### Scenario: A user prefers reduced motion

- **WHEN** `prefers-reduced-motion: reduce` is enabled
- **THEN** gauge animation, hover movement, shimmer, and route transition motion are disabled
- **AND** selected, focused, loading, and status states remain visually distinguishable

#### Scenario: Assistive technology reads the score gauge

- **WHEN** a screen reader encounters the selected-team score panel
- **THEN** it receives the team identity and numeric score through text or an accessible name
- **AND** decorative gauge ticks, gradients, and glow effects are hidden from the accessibility tree
