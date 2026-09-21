# Tasks: Скиллы оценки

## Setup

- [X] T001 [P] Зафиксировать план реализации скиллов и границы зависимости от 001 в `specs/002-review-skills/plan.md`

## Core implementation

- [X] T002 [P] [US1] Создать read-only skill-протокол backend с динамическим чтением `rubrics/backend.v1.yaml` и JSON-контрактом в `.claude/skills/review-backend/SKILL.md`
- [X] T003 [P] [US2] Создать read-only skill-протокол frontend с динамическим чтением `rubrics/frontend.v1.yaml` и поддержкой подкаталога области в `.claude/skills/review-frontend/SKILL.md`
- [X] T004 [US3] Добавить в оба skill-протокола защиту от prompt injection, классификацию предупреждений и evidence-ссылку на место попытки влияния в `.claude/skills/review-backend/SKILL.md` и `.claude/skills/review-frontend/SKILL.md`

## Verification

- [X] T005 [P] Добавить статическую проверку обязательных инструкций, версий и отсутствия захардкоженной таксономии в `scripts/test-review-skills.sh`
- [X] T006 [US4] Проверить оба skill-артефакта скриптом и зафиксировать ограничение: sanity-прогоны на двух репозиториях выполняются после появления контракта 001 и рубрик
