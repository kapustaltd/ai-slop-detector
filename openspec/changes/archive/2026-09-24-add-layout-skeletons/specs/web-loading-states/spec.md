# Web loading states

## ADDED Requirements

### Requirement: Loading states reflect the pending page layout

The web application MUST show layout-matched skeleton placeholders while route data is loading.

#### Scenario: Leaderboard data is not ready

- **WHEN** the leaderboard has no loaded index
- **THEN** the page shows placeholders for its heading, toolbar, and result content
- **AND** the result placeholder adapts between the desktop table and mobile card layouts

#### Scenario: Team details are loading

- **WHEN** the team page is loading its bundle
- **THEN** the page shows placeholders for the breadcrumb/header, score summary, and profile content

#### Scenario: Team registry is loading

- **WHEN** the registry API is loading its team list
- **THEN** the list region shows a table header and placeholder rows matching its columns

### Requirement: Skeletons use a shared, motion-aware primitive

The application MUST use a shared skeleton primitive with the existing light and dark themes,
CSS-only shimmer animation, and no visible borders on placeholder shapes.

#### Scenario: Reduced motion is enabled

- **WHEN** the user has requested reduced motion
- **THEN** skeleton placeholders remain visible without animated shimmer

#### Scenario: Loading placeholders are exposed to assistive technology

- **WHEN** a page displays skeleton placeholders
- **THEN** the loading region exposes `aria-busy="true"` and an accessible loading label
- **AND** each decorative placeholder is hidden from the accessibility tree

### Requirement: Loading does not alter page data behavior

Skeleton states MUST preserve the existing route, API, retry, and data loading behavior.

#### Scenario: Data loading succeeds or fails

- **WHEN** the existing loading operation resolves or fails
- **THEN** the page transitions to its existing ready, pending, empty, or error state
