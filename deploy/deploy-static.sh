#!/usr/bin/env bash

set -Eeuo pipefail

: "${ARTIFACT_PATH:?ARTIFACT_PATH is required}"
: "${DEPLOY_ROOT:?DEPLOY_ROOT is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"
: "${KEEP_RELEASES:?KEEP_RELEASES is required}"

die() {
  echo "deploy failed: $*" >&2
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

case "$ARTIFACT_PATH" in
  /*) ;;
  *) die 'ARTIFACT_PATH must be absolute' ;;
esac

case "$DEPLOY_ROOT" in
  /*) ;;
  *) die 'DEPLOY_ROOT must be absolute' ;;
esac

case "$RELEASE_ID" in
  ''|*[![:alnum:]._-]*) die 'RELEASE_ID contains unsupported characters' ;;
esac

case "$KEEP_RELEASES" in
  ''|*[!0-9]*) die 'KEEP_RELEASES must be an integer' ;;
esac

(( KEEP_RELEASES >= 2 )) || die 'KEEP_RELEASES must retain current and previous releases'
[[ -s "$ARTIFACT_PATH" ]] || die "artifact not found or empty: $ARTIFACT_PATH"

release_root="$DEPLOY_ROOT/releases"
release_dir="$release_root/$RELEASE_ID"
current_link="$DEPLOY_ROOT/current"
previous_link="$DEPLOY_ROOT/previous"
current_tmp="$DEPLOY_ROOT/.current-$RELEASE_ID"
previous_tmp="$DEPLOY_ROOT/.previous-$RELEASE_ID"

mkdir -p "$release_root"
release_root_real="$(cd "$release_root" && pwd -P)"
release_real="$release_root_real/$RELEASE_ID"
trap 'rm -f -- "$ARTIFACT_PATH" "$current_tmp" "$previous_tmp"' EXIT

if [[ -L "$current_link" ]] && [[ "$(readlink -f "$current_link")" == "$release_real" ]]; then
  [[ -s "$current_link/index.html" ]] || die 'current already points to an invalid release'
  echo "release $RELEASE_ID is already current"
  exit 0
fi

if [[ -e "$current_link" && ! -L "$current_link" ]]; then
  die "$current_link exists and is not a symlink"
fi
if [[ -e "$previous_link" && ! -L "$previous_link" ]]; then
  die "$previous_link exists and is not a symlink"
fi

if [[ -e "$release_dir" || -L "$release_dir" ]]; then
  rm -rf -- "$release_dir"
fi
mkdir -m 0755 "$release_dir"

tar --extract --gzip --file "$ARTIFACT_PATH" \
  --directory "$release_dir" \
  --no-same-owner \
  --no-same-permissions

[[ -f "$release_dir/index.html" ]] || die 'release does not contain index.html'
[[ ! -L "$release_dir/index.html" ]] || die 'index.html must not be a symlink'
[[ -s "$release_dir/index.html" ]] || die 'index.html is empty'

if [[ -L "$current_link" ]]; then
  current_target="$(readlink "$current_link")"
  ln -sfn "$current_target" "$previous_tmp"
  replace_symlink "$previous_tmp" "$previous_link"
fi

ln -sfn "$release_dir" "$current_tmp"
replace_symlink "$current_tmp" "$current_link"

[[ "$(readlink -f "$current_link")" == "$release_real" ]] || die 'current symlink verification failed'
[[ -s "$current_link/index.html" ]] || die 'current release verification failed'

old_releases="$(ls -dt "$release_root"/* 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))")"
while IFS= read -r old_release; do
  [[ -n "$old_release" ]] || continue
  case "$old_release" in
    "$release_root"/*) rm -rf -- "$old_release" ;;
    *) die "refusing to remove path outside release root: $old_release" ;;
  esac
done <<< "$old_releases"

echo "deployed $RELEASE_ID to $current_link"
