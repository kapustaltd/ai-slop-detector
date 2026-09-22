# Tasks: CI/CD для публикации фронтенда

**Feature**: `010-ci-cd-deployment`

## Phase 1 — Specification

- [x] T001 Создать spec с user stories, требованиями, scope и assumptions.
- [x] T002 Создать plan с constitution check, архитектурой и verification.
- [x] T003 Провести checklist spec и отметить оставшиеся риски.

## Phase 2 — Deployment implementation

- [x] T004 Добавить GitHub Actions workflow для PR checks, build artifact и main-only deploy.
- [x] T005 Добавить удалённый idempotent deploy script с atomic `current`/`previous` switch и
      smoke test.
- [x] T006 Добавить rollback script и документировать команды восстановления.
- [x] T007 Добавить пример конфигурации static web-server и инструкцию GitHub secrets.

## Phase 3 — Verification and handoff

- [x] T008 Проверить shell/YAML/config consistency и локальный build/check; build и deployment smoke
      test проходят, полный check заблокирован pre-existing синтаксической ошибкой в
      `web/scripts/contract.mjs`.
- [x] T009 Обновить checklist и статус спецификации; production setup оставлен явным pending.
- [x] T010 Создать осмысленный commit только с файлами этой фичи.
