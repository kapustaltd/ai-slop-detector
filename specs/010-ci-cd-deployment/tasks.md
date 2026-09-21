# Tasks: CI/CD для публикации фронтенда

**Feature**: `010-ci-cd-deployment`

## Phase 1 — Specification

- [x] T001 Создать spec с user stories, требованиями, scope и assumptions.
- [x] T002 Создать plan с constitution check, архитектурой и verification.
- [x] T003 Провести checklist spec и отметить оставшиеся риски.

## Phase 2 — Deployment implementation

- [ ] T004 Добавить GitHub Actions workflow для PR checks, build artifact и main-only deploy.
- [ ] T005 Добавить удалённый idempotent deploy script с atomic `current`/`previous` switch.
- [ ] T006 Добавить rollback script и документировать команды восстановления.
- [ ] T007 Добавить пример конфигурации static web-server и инструкцию GitHub secrets.

## Phase 3 — Verification and handoff

- [ ] T008 Проверить shell/YAML/config consistency и локальный build/check.
- [ ] T009 Обновить checklist и статус спецификации после прохождения критериев.
- [ ] T010 Создать осмысленный commit только с файлами этой фичи.
