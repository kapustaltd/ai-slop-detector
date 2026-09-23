# Guided team entry

## Goal

Before a team enters the registry, an operator sees what repository and branch will be evaluated, supplies the remaining identity, and explicitly confirms the entry. This is a deterministic conversation, not an LLM claim.

## Flow

1. Ask for an HTTPS GitHub repository URL. Normalize a trailing slash and `.git`; reject malformed URLs and duplicates already in the registry.
2. Show a short verification state while checking the existing registry. Explain that repository content and access have not yet been inspected.
3. Ask for team name, stable ID, branch and active state. Suggest name and ID from the repository path; all values remain editable.
4. Show a summary of exactly what will be saved and what the next evaluation will test: selected branch, rubric areas and code findings. State that registration does not run an evaluation.
5. Only the confirmation action calls `POST /api/teams`. On success refresh the list; on failure retain the draft for retry.

## UI contract

- Existing light/dark tokens and Geist typography remain authoritative.
- Conversation messages use clear speaker labels, no fake typing or fabricated AI analysis.
- Registry is a compact, semantic table with horizontal scrolling on narrow screens.
- Loading, empty, error, saving, success and keyboard focus are visible.
- Copy names actual operations and avoids generic AI assurances.

## Source decision

- Shoogle is a discovery index, not a runtime dependency.
- Kobra Conversation supplies the message/bubble composition pattern. Local styling follows this product's tokens.
- Kobra CRM Table is a paid, CRM-specific component. Its scan-friendly column structure informed the registry table; no paid source is copied or represented as installed.
- loading.dev was unavailable during implementation; the local indeterminate rail is an original CSS implementation, with reduced-motion fallback and no simulated percentage.
