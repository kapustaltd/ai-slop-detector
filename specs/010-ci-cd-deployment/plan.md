# Plan: CI/CD для публикации фронтенда

**Feature**: `010-ci-cd-deployment`

## Constitution Check

- I. Воспроизводимость: артефакт собирается из commit, а имя release содержит полный SHA.
- IV. Недоверенный ввод: pipeline передаёт на сервер только собственный build-артефакт; команды из
  `web` не выполняются на production-сервере.
- VIII. Тесты: quality gate включает существующий `npm run check` и production build; shell-скрипты
  проверяются `bash -n`.
- X. Секреты: SSH key и host key живут только в GitHub Environment secrets; permissions workflow —
  `contents: read`.
- Workflow SDD: сначала создаются spec/plan/tasks, затем workflow и deployment scripts.

## Architecture

```text
pull_request / push main
        |
        v
GitHub-hosted runner: npm ci -> npm run check -> npm run build
        |
        v
upload/download artifact: web/dist.tar.gz
        |
        v (main only, production environment)
strict SSH + scp -> /tmp/<sha>.tar.gz
        |
        v
remote deploy script -> releases/<sha> -> validate -> current <- previous
        |
        v
optional HTTP smoke check
```

## Implementation Units

1. `spec.md`, `plan.md`, `tasks.md`, checklist — согласовать scope и гейты.
2. `.github/workflows/ci-cd.yml` — quality gate, artifact handoff, production deploy,
   concurrency и strict SSH.
3. `deploy/deploy-static.sh` — idempotent release extraction, atomic symlink switch, retention.
4. `deploy/rollback-static.sh` — atomic swap `current`/`previous`.
5. `deploy/nginx.conf.example` и `deploy/README.md` — one-time server setup, secrets и rollback
   runbook.

## Security Decisions

- Используется GitHub-hosted runner, чтобы production-сервер не хранил runner token.
- Host key передаётся как secret и проверяется через `StrictHostKeyChecking=yes`; `ssh-keyscan` в
  workflow запрещён.
- На первом этапе сохраняется запрошенный root SSH-доступ, но это явно отмечено как hardening
  follow-up.
- Workflow не имеет `contents: write`, не использует shell-команды из репозитория на сервере,
  кроме собственного versioned deployment script.

## Verification

- Статическая проверка YAML и shell-синтаксиса.
- Локально: `npm run check`, `npm run build`.
- Локально: сценарий deployment script на временном каталоге с двумя mock-релизами и rollback.
- Проверка `git diff --check` и отсутствие секретных шаблонов в новых файлах.
