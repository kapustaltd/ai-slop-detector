# Implementation Plan: Главная страница — рейтинг команд

**Branch**: `005-leaderboard` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-leaderboard/spec.md`

## Summary

Страница уже существует функционально (данные, сортировка, фильтры, ссылка в адресе), но
сверстана дефолтами shadcn мимо дизайн-системы. Это переделка вёрстки под макеты
`design/reference/screens/01-03-leaderboard-*.html` и токены `--ds-*`, с попутным выносом кода в
слои `entities`/`widgets` по FSD (сейчас всё в одном файле страницы) и добавлением компонента
`EmptyState`. Данные, сортировка и фильтрация — уже рабочая логика, переносится с минимальными
изменениями; заново собирается только представление.

## Technical Context

**Language/Version**: TypeScript 5, React 19 (спека 008)

**Primary Dependencies**: react-router-dom 7 (hash router), `@tanstack/react-table` (сортировка
таблицы), Tailwind v4 (токены `--ds-*` через `@theme inline`), shadcn/ui примитивы
(`Table`, `Badge`, `Button` — уже добавлены), `cn` для классов

**Storage**: N/A — статический дата-бандл, импорт на сборке (`shared/api/bundle.ts`)

**Testing**: Vitest + Testing Library, запросы по роли/тексту (web/CLAUDE.md, правило 3)

**Target Platform**: статичный SPA, браузер, вёрстка от 360 px

**Project Type**: web (frontend-only, Feature-Sliced Design)

**Performance Goals**: SC-002 — отрисовка < 1 с на данных хакатона (десятки команд)

**Constraints**: без сетевых запросов; страница не вычисляет баллы/места/агрегаты — только
отображает готовые значения (принцип VI); границы слоёв FSD проверяет `eslint-plugin-boundaries` +
`steiger`; обе темы через CSS-переменные, без литеральных цветов в разметке

**Scale/Scope**: десятки команд (спека: масштаб — «десятки», без виртуализации, но вёрстка не
должна ломаться на сотнях строк)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Принцип | Применимо | Статус |
|---|---|---|
| I. Воспроизводимость | косвенно — поля координат прогона не показываются на этой странице | N/A для UI |
| II. Прозрачность | частично — рейтинг не раскрывает rationale/findings, это уровень 006 | N/A для этой фичи |
| III. Справедливость | N/A — про процесс оценки, не про UI | N/A |
| IV. Код команд — данные | N/A — страница не исполняет код команд | N/A |
| V. Платформа не выносит вердикт | **да** — FR-003a: read-only, никаких операций записи/перезапуска/правки баллов | ПРОЙДЕНО — форма фильтров и сортировки не пишет в бандл, только URL |
| VI. Итог считает код, а не LLM | **да** — FR-013: место и итог берутся из бандла как есть, UI не пересчитывает | ПРОЙДЕНО — сортировка переупорядочивает уже готовые значения, не пересчитывает их |
| VII. Contract-first | **да** — все поля из `LeaderboardIndexBundle` (сгенерированный тип) | ПРОЙДЕНО |
| VIII. Тесты на каждую фичу | **да** | ПРОЙДЕНО — тесты на entities/team, widgets/leaderboard-table, page (см. Phase 1) |
| IX. Типы из схемы | **да** | ПРОЙДЕНО — импорт только из `shared/api/generated`, новых типов руками не пишем |
| X. Без секретов | N/A | N/A |

Нарушений нет, Complexity Tracking не заполняется.

## Project Structure

### Documentation (this feature)

```text
specs/005-leaderboard/
├── plan.md              # этот файл
├── research.md          # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
└── contracts/
    ├── url-params.md     # контракт адресной строки (FR-009)
    └── components.md     # публичные пропсы новых компонентов
```

### Source Code (repository root)

```text
web/src/
├── entities/
│   └── team/
│       ├── ui/
│       │   ├── team-status-badge.tsx      # done/failed/no_data/running
│       │   ├── team-warning-badges.tsx    # предупреждения + partial
│       │   └── index.ts
│       ├── model/
│       │   └── status.ts                  # подписи статусов, sortValue, sortTeams
│       └── index.ts
├── widgets/
│   ├── disclaimer-banner/
│   │   ├── ui/disclaimer-banner.tsx        # «вспомогательная метрика, не вердикт» — общая для 005 и 006
│   │   └── index.ts
│   └── leaderboard-table/
│       ├── ui/
│       │   ├── leaderboard-toolbar.tsx     # фильтры, счётчик показанных
│       │   ├── leaderboard-table.tsx       # десктоп: таблица
│       │   ├── leaderboard-row-card.tsx    # мобильный список карточек (<640px)
│       │   └── index.ts
│       ├── model/
│       │   └── use-leaderboard-state.ts    # sort/filter state ↔ URLSearchParams
│       └── index.ts
├── shared/
│   └── ui/
│       └── empty-state.tsx                 # 6-й компонент инвентаря
└── pages/
    └── leaderboard/
        └── ui/leaderboard-page.tsx          # композиция виджетов, заголовок страницы
```

**Structure Decision**: добавляются слои `entities` и `widgets`, которых в проекте ещё не было
(web/CLAUDE.md отмечает это прямо). `entities/team` — потому что бейджи статуса/предупреждений и
сортировка по полям команды переиспользуются на странице команды (006). `widgets/disclaimer-banner`
выделен отдельным виджетом по той же причине: рамка-пояснение обязательна и на 005, и на 006
(DESIGN.md). `widgets/leaderboard-table` — специфичен для этой фичи, `features` не заводится
(правило 4 web/CLAUDE.md: сортировка и фильтры живут внутри своего виджета, не в отдельном слое).

## Расхождения макета с FR — решено

1. **Поиск по названию команды и кнопка «Выгрузить CSV»** (макет `01-leaderboard-light.html`) —
   **ОТВЕЧЕНО 2026-09-22 (docs/open-questions.md, Q12): не реализуются.** Команд немного, поиск не
   оправдан; выгрузка из интерфейса не планируется.
2. **Кнопка «Сортировка: Итог» + «Сбросить» в тулбаре** дублирует сортировку кликом по заголовку
   колонки, которая уже покрывает FR-007. Решение (не оспорено): не собирать отдельный
   dropdown-контрол, сортировка — через заголовки таблицы (десктоп) и один явный контрол на
   мобильном тулбаре, где заголовков нет.
3. **Кнопка повтора у статуса «не удалось»** — **ОТВЕЧЕНО 2026-09-22 (Q14): не нужна.** Платформа
   собирает статический бандл в билд — «повтор» в интерфейсе не имеет смысла в этой архитектуре.
   Показывается причина, время попытки и подсказка с командой пайплайна для оператора.
4. **Строка легенды/сводки рубрики** внизу макета («Итог = 0.5 × backend + 0.5 × frontend», счётчики
   категорий/метрик, версии рубрик) — не в FR-001..015, и данных для неё нет в
   `LeaderboardIndexBundle` (только `meta.rubric_versions`/`meta.skill_versions` без разбивки по
   area). Решение (не оспорено): не выводить блок, не расширять индекс бандла в обход контракта 004.
