#!/usr/bin/env bash

set -Eeuo pipefail

: "${DEPLOY_ROOT:?DEPLOY_ROOT is required}"

SERVE_ROOT="${SERVE_ROOT:-}"

die() {
  echo "rollback failed: $*" >&2
  exit 1
}

replace_symlink() {
  local source_link="$1"
  local destination_link="$2"

  if mv --version >/dev/null 2>&1; then
    mv -Tf "$source_link" "$destination_link"
    return
  fi

  # BSD mv (for local macOS validation) has no -T. Production runs on Ubuntu/GNU coreutils.
  local target
  target="$(readlink "$source_link")"
  ln -sfn "$target" "$destination_link"
  rm -f -- "$source_link"
}

case "$DEPLOY_ROOT" in
  /*) ;;
  *) die 'DEPLOY_ROOT must be absolute' ;;
esac

if [[ -n "$SERVE_ROOT" ]]; then
  case "$SERVE_ROOT" in
    /*) ;;
    *) die 'SERVE_ROOT must be absolute' ;;
  esac
fi

current_link="$DEPLOY_ROOT/current"
previous_link="$DEPLOY_ROOT/previous"
current_tmp="$DEPLOY_ROOT/.current-rollback-$$"
previous_tmp="$DEPLOY_ROOT/.previous-rollback-$$"

trap 'rm -f -- "$current_tmp" "$previous_tmp"' EXIT

[[ -L "$current_link" ]] || die "$current_link is not a symlink"
[[ -L "$previous_link" ]] || die "$previous_link does not exist"

current_target="$(readlink "$current_link")"
previous_target="$(readlink "$previous_link")"

[[ -s "$(readlink -f "$previous_link")/index.html" ]] || die 'previous release is invalid'

ln -sfn "$previous_target" "$current_tmp"
replace_symlink "$current_tmp" "$current_link"

ln -sfn "$current_target" "$previous_tmp"
replace_symlink "$previous_tmp" "$previous_link"

if [[ -n "$SERVE_ROOT" ]]; then
  [[ -d "$SERVE_ROOT" ]] || die "SERVE_ROOT is not an existing directory: $SERVE_ROOT"
  stage_dir="$(mktemp -d "$(dirname "$SERVE_ROOT")/.$(basename "$SERVE_ROOT").rollback-XXXXXX")"
  trap 'rm -rf -- "$stage_dir" "$current_tmp" "$previous_tmp"' EXIT

  tar --create --file - --directory "$current_link" . \
    | tar --extract --file - --directory "$stage_dir" --no-same-owner --no-same-permissions
  find "$SERVE_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  tar --create --file - --directory "$stage_dir" . \
    | tar --extract --file - --directory "$SERVE_ROOT" --no-same-owner --no-same-permissions
  [[ -s "$SERVE_ROOT/index.html" ]] || die 'served root rollback verification failed'
fi

echo "rolled back: current=$previous_target previous=$current_target"
