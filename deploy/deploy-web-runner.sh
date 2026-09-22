#!/usr/bin/env bash

set -Eeuo pipefail

: "${ARTIFACT_PATH:?ARTIFACT_PATH is required}"
: "${RUNNER_ROOT:?RUNNER_ROOT is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"
: "${KEEP_RELEASES:?KEEP_RELEASES is required}"
: "${RUNNER_SERVICE:=ai-slop-detector-web-runner.service}"

die() {
  echo "web runner deploy failed: $*" >&2
  exit 1
}

replace_symlink() {
  local source_link="$1"
  local destination_link="$2"
  if mv --version >/dev/null 2>&1; then
    mv -Tf "$source_link" "$destination_link"
    return
  fi
  local target
  target="$(readlink "$source_link")"
  ln -sfn "$target" "$destination_link"
  rm -f -- "$source_link"
}

case "$ARTIFACT_PATH" in /*) ;; *) die 'ARTIFACT_PATH must be absolute' ;; esac
case "$RUNNER_ROOT" in /*) ;; *) die 'RUNNER_ROOT must be absolute' ;; esac
case "$RELEASE_ID" in ''|*[![:alnum:]._-]*) die 'RELEASE_ID contains unsupported characters' ;; esac
case "$KEEP_RELEASES" in ''|*[!0-9]*) die 'KEEP_RELEASES must be an integer' ;; esac
(( KEEP_RELEASES >= 2 )) || die 'KEEP_RELEASES must retain current and previous releases'
[[ -s "$ARTIFACT_PATH" ]] || die "artifact not found or empty: $ARTIFACT_PATH"

release_root="$RUNNER_ROOT/releases"
release_dir="$release_root/$RELEASE_ID"
current_link="$RUNNER_ROOT/current"
previous_link="$RUNNER_ROOT/previous"
current_tmp="$RUNNER_ROOT/.current-$RELEASE_ID"
previous_tmp="$RUNNER_ROOT/.previous-$RELEASE_ID"

mkdir -p "$release_root"
release_root_real="$(cd "$release_root" && pwd -P)"
release_real="$release_root_real/$RELEASE_ID"
trap 'rm -f -- "$ARTIFACT_PATH" "$current_tmp" "$previous_tmp"' EXIT

if [[ -e "$release_dir" || -L "$release_dir" ]]; then
  rm -rf -- "$release_dir"
fi
mkdir -m 0755 "$release_dir"
tar --extract --gzip --file "$ARTIFACT_PATH" --directory "$release_dir" --no-same-owner --no-same-permissions

[[ -x "$release_dir/web-runner" ]] || die 'release does not contain an executable web-runner'
[[ -s "$release_dir/rubrics/backend.v1.yaml" ]] || die 'backend rubric is missing'
[[ -s "$release_dir/rubrics/frontend.v1.yaml" ]] || die 'frontend rubric is missing'
if [[ -e "$current_link" && ! -L "$current_link" ]]; then die "$current_link exists and is not a symlink"; fi
if [[ -e "$previous_link" && ! -L "$previous_link" ]]; then die "$previous_link exists and is not a symlink"; fi

if [[ -L "$current_link" ]]; then
  ln -sfn "$(readlink "$current_link")" "$previous_tmp"
  replace_symlink "$previous_tmp" "$previous_link"
fi
ln -sfn "$release_dir" "$current_tmp"
replace_symlink "$current_tmp" "$current_link"

[[ "$(readlink -f "$current_link")" == "$release_real" ]] || die 'current symlink verification failed'
systemctl restart "$RUNNER_SERVICE"
systemctl is-active --quiet "$RUNNER_SERVICE" || die "service is not active: $RUNNER_SERVICE"

old_releases="$(ls -dt "$release_root"/* 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))")"
while IFS= read -r old_release; do
  [[ -n "$old_release" ]] || continue
  case "$old_release" in
    "$release_root"/*) rm -rf -- "$old_release" ;;
    *) die "refusing to remove path outside release root: $old_release" ;;
  esac
done <<< "$old_releases"

echo "deployed web runner $RELEASE_ID to $current_link"
