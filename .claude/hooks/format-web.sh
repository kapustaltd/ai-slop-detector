#!/usr/bin/env bash
# PostToolUse: форматирует и автоисправляет изменённый файл фронтенда.
# Вход — JSON события на stdin. Файлы вне web/src игнорируются.
set -u

f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

case "$f" in
  *"/web/src/"*.ts | *"/web/src/"*.tsx) ;;
  *) exit 0 ;;
esac

web_dir="${f%%/web/src/*}/web"
cd "$web_dir" || exit 0

npx prettier --write "$f" >/dev/null 2>&1
npx eslint --fix "$f" >/dev/null 2>&1

exit 0
