#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT

archive_for() {
  local archive_path="$1"
  tar -C "$repo_root/web/dist" -czf "$archive_path" .
}

deploy_release() {
  local release_id="$1"
  local archive_path="$2"
  DEPLOY_ROOT="$test_root/site" \
    SERVE_ROOT="$test_root/served" \
    ARTIFACT_PATH="$archive_path" \
    RELEASE_ID="$release_id" \
    KEEP_RELEASES=2 \
    bash "$script_dir/deploy-static.sh"
}

mkdir -p "$test_root/served"
printf 'stale\n' > "$test_root/served/stale.txt"
archive_for "$test_root/first.tar.gz"
deploy_release 1111111111111111111111111111111111111111 "$test_root/first.tar.gz"
test "$(readlink -f "$test_root/site/current")" = \
  "$(readlink -f "$test_root/site/releases/1111111111111111111111111111111111111111")"

archive_for "$test_root/repeated.tar.gz"
deploy_release 1111111111111111111111111111111111111111 "$test_root/repeated.tar.gz"

archive_for "$test_root/second.tar.gz"
deploy_release 2222222222222222222222222222222222222222 "$test_root/second.tar.gz"
test "$(readlink -f "$test_root/site/current")" = \
  "$(readlink -f "$test_root/site/releases/2222222222222222222222222222222222222222")"
test "$(readlink -f "$test_root/site/previous")" = \
  "$(readlink -f "$test_root/site/releases/1111111111111111111111111111111111111111")"
test -s "$test_root/site/current/index.html"
test -s "$test_root/served/index.html"
test ! -e "$test_root/served/stale.txt"

DEPLOY_ROOT="$test_root/site" SERVE_ROOT="$test_root/served" bash "$script_dir/rollback-static.sh"
test "$(readlink -f "$test_root/site/current")" = \
  "$(readlink -f "$test_root/site/releases/1111111111111111111111111111111111111111")"
test "$(readlink -f "$test_root/site/previous")" = \
  "$(readlink -f "$test_root/site/releases/2222222222222222222222222222222222222222")"
test -s "$test_root/served/index.html"

echo 'static deployment smoke test passed'
