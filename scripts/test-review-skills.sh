#!/usr/bin/env bash
set -euo pipefail

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backend="$repo_root/.claude/skills/review-backend/SKILL.md"
frontend="$repo_root/.claude/skills/review-frontend/SKILL.md"

for skill in "$backend" "$frontend"; do
  test -f "$skill"
  rg -q '^name: review-(backend|frontend)$' "$skill"
  rg -q 'skill_version: "2\.0\.0"' "$skill"
  rg -q 'rubrics/(backend|frontend)\.v1\.yaml' "$skill"
  rg -q 'suspected_prompt_injection' "$skill"
  rg -q 'incomplete_area' "$skill"
  rg -q 'repo_too_large' "$skill"
  rg -q 'Печатай только один JSON-объект' "$skill"
  rg -q 'Do not compute category, area, team, or ranking aggregates' "$skill"
  rg -q '`anchor`' "$skill"
  rg -q '`evidence`' "$skill"
  # meta — задача пайплайна, не модели.
  if rg -qF '"meta"' "$skill"; then
    printf 'review skill still asks the model to write meta: %s\n' "$skill" >&2
    exit 1
  fi
done

# The skill may mention the rubric as a source, but must not copy its leaf taxonomy.
if test -f "$repo_root/docs/rubric-proposal.md"; then
  while IFS= read -r metric_id; do
    test -n "$metric_id"
    if rg -qF "\`$metric_id\`" "$backend" "$frontend"; then
      printf 'review skill duplicates rubric metric: %s\n' "$metric_id" >&2
      exit 1
    fi
  done < <(
    rg '^\|.*`[a-z][a-z0-9_]+` —' "$repo_root/docs/rubric-proposal.md" \
      | rg -o '`[a-z][a-z0-9_]+`' \
      | tr -d '`' \
      | sort -u
  )
fi

printf 'review skill artifacts: ok\n'
