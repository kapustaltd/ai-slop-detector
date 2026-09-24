# Implementation Plan: Непрерывный ход оценки

**Branch**: `016-progressive-evaluation-trace` | **Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-progressive-evaluation-trace/spec.md`

## Summary

Сделать активную оценку непрерывным потоком от регистрации до готового отчёта: pipeline пишет ограниченные структурированные факты в output текущего прогона, Registry API возвращает их вместе с coarse stage и опубликованными областями, страница оценки показывает trace и скелет из реальных рубрик, рейтинг и экран добавления ведут на тот же flow.

Новая операционная схема прогресса независима от схемы оценочного отчёта. Текущая гранулярность модели — целый отчёт области: промежуточные метрики остаются ожидающими до публикации области, а не симулируются как последовательность внутренних мыслей.

## Technical Context

**Language/Version**: Go (версия из `agent/go.mod`), TypeScript / React 19
**Primary Dependencies**: Go standard library; существующий Vite, React Router, Vitest, JSON Schema codegen
**Storage**: Атомарный JSON snapshot в output directory текущего runner job; оперативное состояние Registry API
**Testing**: Go `testing`; Vitest + Testing Library; контрактная генерация/проверка JSON Schema
**Target Platform**: Registry API и web-клиент проекта
**Project Type**: Go API/pipeline + React web application
**Performance Goals**: Snapshot прогресса доступен в пределах текущего интервала опроса (3–5 секунд); журнал ограничен 20 событиями
**Constraints**: Существующий `runs/<jobID>` используется и для чтения частичного отчёта; результат и сырые ответы модели не входят в прогресс; контракт отчёта 001 не меняется; UI обеих тем и ширина от 360 px
**Scale/Scope**: Одна активная оценка на worker, две области оценки (backend/frontend), до 20 событий на команду в прогоне

## Constitution Check

- **Прозрачность**: события построены из scanner, переходов pipeline и валидированных опубликованных находок.
- **Недоверенный код**: trace не отображает сырое содержимое файла, инструкции или произвольные runner-логи.
- **Read-only результаты**: UI только читает новый прогресс; действия повторной оценки и редактирование результата не добавляются.
- **Contract-first**: новая операционная схема версионируется отдельно; `evaluation-report.schema.json` и data-bundle не меняются.
- **Generated types**: Go- и TypeScript-типы прогресса генерируются из `schemas/evaluation-progress.schema.json`.
- **Тесты**: Go API/pipeline и web-состояния покрываются автотестами; контракт генерируется и проверяется.
- **Secrets**: значения, содержимое исключённых файлов и raw model response никогда не попадают в snapshot.

**Gate**: PASS. Изменений принципов конституции и схемы оценочного отчёта нет.

## Architecture

1. **Pipeline event recorder**
   - В начале прогона создаёт прогресс для активной команды.
   - После snapshot, area detection, сканирования, начала/завершения областей и публикации добавляет allowlisted event.
   - При публикации области добавляет события по проверенным findings, включая только source links со статусом `verified`.
   - Каждый апдейт атомарно сохраняет bounded snapshot внутри `OutputDir/progress/`.
2. **Registry API**
   - Сохраняет существующие статус, coarse stage и started_at.
   - Для активного job читает progress snapshot из `runs/<jobID>/progress/` — того же корня, из которого читается частичный отчёт.
   - Возвращает свежий snapshot при каждом запросе. Старый/невалидный snapshot игнорируется; coarse status остаётся fallback.
3. **Shared progress presentation**
   - Вынести timeline, детали и журнал событий в общий widget.
   - На странице добавления он остаётся компактной информацией о текущем запуске.
   - На странице команды он отображает этапы, подтверждённые события, skeleton по загруженным рубрикам и готовые области.
4. **Progressive report**
   - Страница команды загружает rubrics и live status даже если частичный team bundle ещё не существует.
   - До первой опубликованной области показывает skeleton с категориями и метриками обеих рубрик.
   - Текущую область отмечает `running`; категории/метрики остаются в ожидании, пока валидный отчёт области не станет доступен.
   - После атомарной публикации заменяет skeleton этой области существующим компонентом отчёта.
5. **Leaderboard navigation**
   - Статус running становится ссылкой на `/team/{id}` с этапом, когда он известен.
   - Завершённая оценка ведёт в отчёт; текущий running label читается как ход работы.

## Project Structure

```text
schemas/
└── evaluation-progress.schema.json
agent/internal/contract/
└── evaluation_progress.gen.go
agent/internal/pipeline/
├── pipeline.go
├── progress.go
└── pipeline_test.go
agent/internal/registryapi/
├── evaluation.go
├── remote_evaluator.go
└── evaluation_test.go
web/scripts/contract.mjs
web/src/shared/api/
├── generated/evaluation-progress.ts
└── registry.ts
web/src/widgets/evaluation-progress/
├── model/
└── ui/
web/src/pages/team/
└── ui/team-page.tsx
web/src/pages/team-management/
└── ui/team-management-page.tsx
web/src/widgets/leaderboard-table/
├── ui/leaderboard-table.tsx
└── ui/leaderboard-row-card.tsx
specs/016-progressive-evaluation-trace/
├── spec.md
├── plan.md
├── tasks.md
├── data-model.md
├── research.md
└── contracts/evaluation-progress.md
```

**Structure Decision**: Использовать существующие Go packages и FSD-слои. Новый widget отвечает за повторно используемую презентацию progress trace; API-типы — generated; страница команды остаётся владельцем загрузки отчёта и рубрик.

## Risks and Mitigations

- **Событие может быть воспринято как вывод модели**: разделить статические pipeline events и findings; маркировать finding ссылкой на verified source; сырой CoT запрещён.
- **Параллельные области**: защищать sequence и запись snapshot mutex-ом; состояния областей независимы.
- **Race между частичным отчётом и progress-файлом**: писать оба атомарно, объединять их как независимые источники, считать доступность отчёта только по report bundle.
- **Старый runner без telemetry-файла**: сохранить coarse response и построить skeleton из рубрик без выдуманных событий.
- **Трафик/рост файла**: атомарный snapshot не более 20 событий, обновление только при событии.

## Validation Strategy

- Проверить JSON Schema ↔ Go/TS generated files через `npm run contract:check`.
- Проверить формирование progress snapshot, bounding журнала, scan counts и verified findings Go-тестами.
- Проверить API: текущий job snapshot читается, старые job snapshots игнорируются, legacy runner fallback работает.
- Проверить web: skeleton без partial bundle, замена skeleton готовой областью, сохранение trace при polling failure, статусы/ссылки настольного и мобильного рейтинга.
- Прогнать узкие Go и Vitest проверки, затем web `npm run check` и Go `go test ./...` перед завершением.
