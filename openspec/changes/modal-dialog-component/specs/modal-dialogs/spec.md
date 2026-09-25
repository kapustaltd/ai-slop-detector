# Modal dialogs

## Requirements

### Requirement: Reusable accessible modal dialogs

The web application MUST provide one shared modal controller that supports any number of dialogs.

#### Scenario: Open a modal through a trigger

- **WHEN** a user activates an element with `data-md-open` matching a modal id
- **THEN** the matching dialog opens and receives focus
- **AND** the trigger is not given disclosure-only `aria-expanded` state

#### Scenario: Dialog semantics and closing controls

- **WHEN** a modal is rendered
- **THEN** its dialog has `role="dialog"`, `aria-modal="true"`, and a labelled heading
- **AND** optional body text is connected using `aria-describedby`
- **AND** header close, `data-md-close`, Escape, and backdrop pointer interactions dismiss it
- **AND** pointer interactions inside the dialog do not dismiss it

### Requirement: Keyboard and focus behavior

The modal controller MUST keep keyboard focus within the topmost open dialog and restore focus on
close.

#### Scenario: Focus enters a dialog

- **WHEN** a dialog opens
- **THEN** focus moves to the first visible `[autofocus]` element, otherwise the first visible
  focusable element, otherwise the dialog container

#### Scenario: Tab reaches a dialog boundary

- **WHEN** the user presses Tab or Shift+Tab at a focus boundary
- **THEN** the focusable list is recomputed and focus wraps to the opposite boundary

#### Scenario: A stack of dialogs is open

- **WHEN** the user presses Escape while multiple dialogs are open
- **THEN** only the topmost dialog closes
- **AND** closing a dialog returns focus to the element that opened it

### Requirement: Scroll lock and motion preferences

The modal controller MUST prevent page scrolling while one or more dialogs are open and preserve
the document's original inline scroll styles.

#### Scenario: Several dialogs share a scroll lock

- **WHEN** one dialog closes while another remains open
- **THEN** page scrolling remains locked until the last dialog closes

#### Scenario: Reduced motion is requested

- **WHEN** the user prefers reduced motion
- **THEN** modal entrance and exit transitions are skipped

### Requirement: Safe dialog content

The demo MUST render dialog content through React elements and text APIs without injecting HTML
strings or evaluating code.
