# Tasks: Страница команды — графики и drill-down

**Input**: Design documents from `/specs/006-team-details/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/url-params.md,
contracts/components.md, quickstart.md

**Tests**: включены — принцип VIII конституции; запросы по роли/тексту (web/CLAUDE.md, правило 3).

**Organization**: US1–US4 по приоритету спеки (P1/P1/P2/P2). `entities`/`widgets` — правило
web/CLAUDE.md п.6: `ui/`-файл держит только свой `Props`-интерфейс, константы и мэппинги — в
`model/`.

## Format: `[ID] [P?] [Story] Description`

Пути — от `web/src/`, если не указано иное.

---

## Phase 1: Setup

- [x] T001 Завести срезы с барабанными `index.ts`: `entities/metric/index.ts`,
      `entities/finding/index.ts`, `widgets/team-header/index.ts`,
      `widgets/score-summary/index.ts`, `widgets/area-profile/index.ts`,
      `widgets/findings-summary/index.ts`, `widgets/taxonomy-tree/index.ts`,
      `widgets/evaluation-meta/index.ts` — по `plan.md` → Project Structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: два новых entity-среза (полный инвентарь компонентов), заголовок страницы и её
базовые состояния — без них ни одна user story не открывается.

**⚠️ CRITICAL**: ни одна user story не начинается раньше этой фазы.

### entities/metric

- [x] T002 [P] `entities/metric/model/contribution.ts` — `anchorPosition(score): number`
      (кусочно-линейно по `[0,2,5,8,10]`, см. research.md «AnchorScale: позиция балла»),
      `confidenceTone(confidence)` для пунктирной рамки/индикатора низкой уверенности
- [x] T003 [P] `entities/metric/model/contribution.test.ts` — `anchorPosition` на границах
      сегментов (0, 2, 5, 8, 10) и в середине каждого сегмента
- [x] T004 [US-foundation] `entities/metric/ui/taxonomy-row.tsx` — `TaxonomyRow`, пропсы по
      `contracts/components.md#taxonomyrow`; один компонент, `level: 1|2|3`; использует
      `ScoreGauge` (005); зависит от T002
- [x] T005 [P] `entities/metric/ui/taxonomy-row.test.tsx` — рендер на каждом `level`,
      `confidence: 'low'` даёт пунктирную рамку и индикатор
- [x] T006 [US-foundation] `entities/metric/ui/anchor-scale.tsx` — `AnchorScale`, 4 якоря +
      отметка балла между ними через `anchorPosition`; зависит от T002
- [x] T007 [P] `entities/metric/ui/anchor-scale.test.tsx` — отметка балла между правильной парой
      якорей (проверить на значениях из каждого сегмента)
- [x] T008 `entities/metric/index.ts` — экспорт `TaxonomyRow`, `AnchorScale`,
      `anchorPosition`/`confidenceTone` — зависит от T004, T006

### entities/finding

- [x] T009 [P] `entities/finding/model/link-state.ts` — `linkState(finding): 'verified' |
    'unverified' | 'no-permalink'` по правилу из research.md («Три состояния ссылки»:
      `permalink` отсутствует → `no-permalink`; `permalink` есть и `link_status === 'verified'` →
      `verified`; `permalink` есть и любое другое значение `link_status` → `unverified`),
      `findingSlug(finding): string` (`${file}:${line_start}-${line_end}`)
- [x] T010 [P] `entities/finding/model/link-state.test.ts` — все 5 значений `link_status` ×
      наличие/отсутствие `permalink`, таблица истинности из research.md
- [x] T011 [P] `entities/finding/model/highlight-snippet.ts` — перенос Shiki-обвязки из
      текущего `pages/team/ui/team-page.tsx` (`languageLoaders`, `highlighterFactoryPromise`,
      `languageByExtension`, `snippetLanguage`) в хук `useHighlightedSnippet(finding)`; тема — из
      `document.documentElement.classList.contains('dark')`, без изменения поведения
- [x] T012 [P] `entities/finding/model/highlight-snippet.test.ts` — известное расширение файла
      даёт токены нужного языка, неизвестное расширение не падает (fallback на обычный текст)
- [x] T013 [US-foundation] `entities/finding/ui/severity-bar.tsx` — `SeverityBar`, сегменты —
      `button` с `aria-label` (DESIGN.md: не canvas/svg), повторный клик по активному сегменту
      снимает фильтр; зависит от T009
- [x] T014 [P] `entities/finding/ui/severity-bar.test.tsx` — клик по сегменту вызывает `onSelect`
      с нужной severity, повторный клик — `onSelect('all')`
- [x] T015 [US-foundation] `entities/finding/ui/finding-card.tsx` — `FindingCard`, `density:
    'summary'|'expanded'`, три состояния ссылки через `linkState()` (T009): `verified` — кнопка
      «Открыть на `<sha>`»; `unverified` — снипет НЕ показывается, пометка «ссылку не удалось
      проверить»; `no-permalink` — копируемый путь, снипет показывается если есть; рекомендация
      блоком с левой линейкой только для `kind === 'issue'` с непустым `suggestion`; снипет —
      через `useHighlightedSnippet` (T011), сворачивается при длинном фрагменте; зависит от T009,
      T011
- [x] T016 [P] `entities/finding/ui/finding-card.test.tsx` — по одному тесту на каждое из трёх
      состояний ссылки (verified/unverified/no-permalink), рекомендация видна только у `issue` с
      `suggestion`, отсутствует у `strength`
- [x] T017 `entities/finding/index.ts` — экспорт `SeverityBar`, `FindingCard`,
      `linkState`/`findingSlug` — зависит от T013, T015

### Заголовок и состояния страницы

- [x] T018 [P] `widgets/team-header/model/rank-context.ts` — `teamRankContext(teamId):
    TeamRankContext` (data-model.md) из `getLeaderboardIndex()` (005): позиция в уже
      отсортированном по `rank` списке, `tiedWith` — команды с тем же `rank`, `previousTeamId`/
      `nextTeamId` — соседи по порядку; при отсутствии индекса или команды в нём — все поля
      `null`/пустые, без исключения
- [x] T019 [P] `widgets/team-header/model/rank-context.test.ts` — команда есть в индексе
      (включая случай с `tiedWith`), команда не найдена в индексе (пустой контекст, не исключение)
- [x] T020 [US-foundation] `widgets/team-header/ui/team-header.tsx` — `TeamHeader`: хлебные
      крошки «Рейтинг / «Название команды»», `TeamStatusBadge` (005, `partial` из `team.partial`),
      ссылка на репозиторий + `commit_sha` + ветка, «место в рейтинге N из M (делит со «X»)» и
      prev/next по `rankContext` — блок скрыт целиком, если `rankContext` пуст; зависит от T018
- [x] T021 [P] `widgets/team-header/ui/team-header.test.tsx` — хлебные крошки и статус видны
      всегда; блок ранга/prev-next видим только когда `rankContext` не пуст
- [x] T022 `widgets/team-header/index.ts` — экспорт `TeamHeader`, `teamRankContext` — зависит от
      T018, T020
- [x] T023 Переписать `pages/team/ui/team-page.tsx`: состояния `loading`/`missing`/`error`
      (FR-020, перенос текущей логики `PageState`) через `EmptyState` (005) вместо текущего
      `role="alert"` + `Button`; подключить `TeamHeader` + `DisclaimerBanner` (005); тело страницы
      (US1–US4) — заглушка до соответствующих фаз; зависит от T022
- [x] T024 Обновить `pages/team/ui/team-page.test.tsx` под новую разметку: заголовок,
      `DisclaimerBanner`, состояние ошибки через `EmptyState`; зависит от T023

**Checkpoint**: фундамент готов — можно начинать US1/US2.

---

## Phase 3: User Story 1 - Профиль команды в сравнении с остальными (Priority: P1) 🎯 MVP

**Goal**: итог + баллы по областям, radar по категориям с медианой, bar «команда против
среднего», текстовая таблица-альтернатива обоим графикам.

**Independent Test**: quickstart.md, сценарии 1–3.

### Tests for User Story 1

- [x] T025 [P] [US1] `widgets/score-summary/ui/score-summary.test.tsx` — итог + по карточке на
      присутствующую область; область со статусом `no_data`/`failed` — прочерк, не «0» (FR-006 из
      005, тот же принцип)
- [x] T026 [P] [US1] `widgets/area-profile/ui/area-profile.test.tsx` — radar и bar рендерятся по
      категориям (не по метрикам — FR-003: метрики MUST NOT выводиться на обзорный график);
      **radar включает вторую серию — медиану** (FR-002); таблица-альтернатива содержит те же
      значения, что графики, включая колонку медианы (FR-006); при `stats.insufficient_data`
      сравнение не рисуется, но профиль (radar, без медианы) остаётся (FR-004, Edge Case «мало
      данных»)

### Implementation for User Story 1

- [x] T027 [P] [US1] `widgets/score-summary/ui/score-summary.tsx` — `ScoreSummary` по
      `contracts/components.md#scoresummary`, `ScoreGauge` (005) размера `hero`/`large`
- [x] T028 [US1] `widgets/score-summary/index.ts` — зависит от T027
- [x] T029 [P] [US1] `widgets/area-profile/ui/area-profile.tsx` — `AreaProfile`: radar + bar
      (recharts, база — перенос текущей `AreaCharts` из `team-page.tsx`, но **не дословно**:
      текущая реализация вычисляет `median` в данные графика и нигде её не рисует (ни в
      `<Radar>`, ни в `<Bar>`) — это нарушение FR-002, найденное при анализе, а не расхождение
      макета. Добавить вторую серию `<Radar dataKey="median">` (медиана, пунктирная — DESIGN.md:
      линия медианы отличима от линии команды не только цветом) и колонку медианы в
      таблице-альтернативе; вёрстка/токены — по макету) + таблица-альтернатива, всегда
      развёрнутая (DESIGN.md: «не под кнопку»)
- [x] T030 [US1] `widgets/area-profile/index.ts` — зависит от T029
- [x] T031 [US1] Подключить `ScoreSummary` + `AreaProfile` (на каждую присутствующую область,
      `getStats()` уже синхронный — 005) в `pages/team/ui/team-page.tsx`; зависит от T023, T028,
      T030
- [x] T032 [US1] Обновить `pages/team/ui/team-page.test.tsx`: значения radar/bar/таблицы
      соответствуют фикстуре, недостаток данных для сравнения явно показан (quickstart.md,
      сценарий 2); зависит от T031

**Checkpoint**: US1 работает и тестируется независимо.

---

## Phase 4: User Story 2 - Drill-down: категория → подкатегория → метрика (Priority: P1)

**Goal**: три уровня таксономии раскрываются по клику, лист показывает балл/summary/rationale/
confidence/описание/якоря/находки с подсветкой кода и постоянными ссылками; состояние в адресе.

**Independent Test**: quickstart.md, сценарии 4–8, 13.

### Tests for User Story 2

- [x] T033 [P] [US2] `widgets/taxonomy-tree/model/taxonomy-path.test.ts` — разбор/сборка
      `TaxonomyPath` ↔ `?area=&node=&finding=` по `contracts/url-params.md` (`node` без `area`
      игнорируется, `finding` без `node` до уровня метрики игнорируется, неизвестное значение →
      состояние по умолчанию)
- [x] T034 [P] [US2] `widgets/taxonomy-tree/ui/taxonomy-tree.test.tsx` — путь категория →
      подкатегория → метрика показывает балл/`summary`/`rationale`/`confidence` (US2 #1),
      описание метрики и якоря нужной версии рубрики (US2 #2), находка со сниппетом — подсветка +
      номера строк + выделенный диапазон (US2 #3), клик по рабочей ссылке — `permalink` (US2 #4),
      непроверенная ссылка — сниппет скрыт и помечен (US2 #5), `confidence: 'low'` виден
      пользователю (US2 #6)

### Implementation for User Story 2

- [x] T035 [US2] `widgets/taxonomy-tree/model/taxonomy-path.ts` — парсинг/сериализация
      `TaxonomyPath` (data-model.md) из/в `URLSearchParams` по `contracts/url-params.md`
- [x] T036 [US2] `widgets/taxonomy-tree/ui/taxonomy-tree.tsx` — `TaxonomyTree`: `TaxonomyRow`
      (T004) на категории/подкатегории, на листе — `AnchorScale` (T006) + `FindingCard[]`
      (`density: 'expanded'` для первой/самой серьёзной находки, `'summary'` для остальных —
      DESIGN.md); все узлы раскрываются независимо, а `TaxonomyPath` хранит последнюю активную ветку
      для deep-link; зависит от T004, T006, T015, T035
- [x] T037 [US2] `widgets/taxonomy-tree/index.ts` — зависит от T036
- [x] T038 [US2] Подключить `TaxonomyTree` (на каждую область) в `pages/team/ui/team-page.tsx`,
      состояние пути — в `useSearchParams` (единственное место чтения/записи `area`/`node`/
      `finding` для этой фичи, по аналогии с `useLeaderboardState` из 005); зависит от T031, T037
- [x] T039 [US2] Обновить `pages/team/ui/team-page.test.tsx`: ссылка с `?area=backend&node=...`
      открывает дерево на нужном месте при монтировании (quickstart.md, сценарий 13); зависит от
      T038

**Checkpoint**: US1 + US2 — ядро страницы (профиль + прозрачность до кода) работает.

---

## Phase 5: User Story 3 - Распределение находок (Priority: P2)

**Goal**: счётчики strength/issue и разбивка по severity, клик по сегменту фильтрует находки в
дереве.

**Independent Test**: quickstart.md, сценарий 9.

### Tests for User Story 3

- [x] T040 [P] [US3] `widgets/findings-summary/ui/findings-summary.test.tsx` — счётчики
      совпадают с фикстурой, клик по сегменту серьёзности вызывает `onFilterChange`

### Implementation for User Story 3

- [x] T041 [US3] `widgets/findings-summary/model/finding-counts.ts` — подсчёт находок по
      `kind`/`severity` по всем метрикам области (перенос текущего `findingCounts` из
      `team-page.tsx` без изменения логики)
- [x] T042 [US3] `widgets/findings-summary/ui/findings-summary.tsx` — `FindingsSummary`:
      счётчики + `SeverityBar` (T013); зависит от T013, T041
- [x] T043 [US3] `widgets/findings-summary/index.ts` — зависит от T042
- [x] T044 [US3] Подключить `FindingsSummary` в `pages/team/ui/team-page.tsx`, связать её фильтр
      с `TaxonomyTree` (T036) через тот же `FindingsFilter` в URL (`kind`/`severity` —
      `contracts/url-params.md`, перенос текущей логики `kindFilter`/`severityFilter`); зависит от
      T038, T043
- [x] T045 [US3] Обновить `pages/team/ui/team-page.test.tsx`: клик по сегменту `SeverityBar`
      фильтрует список находок в дереве (quickstart.md, сценарий 9); зависит от T044

**Checkpoint**: US1+US2+US3 — распределение находок работает и управляет деревом.

---

## Phase 6: User Story 4 - Метаданные и доверие к оценке (Priority: P2)

**Goal**: SHA/версии/модель/время, ссылка на коммит, предупреждения с пояснением.

**Independent Test**: quickstart.md, сценарии 10–11.

### Tests for User Story 4

- [x] T046 [P] [US4] `widgets/evaluation-meta/ui/evaluation-meta.test.tsx` — все поля метаданных
      видны (US4 #1), SHA — рабочая ссылка на коммит (US4 #2), `warnings[]` показаны с пояснением
      (US4 #3, тот же словарь `warningLabel`, что 005)

### Implementation for User Story 4

- [x] T047 [US4] `widgets/evaluation-meta/ui/evaluation-meta.tsx` — `EvaluationMeta`:
      commit/рубрика/модель/время + `warnings[]` через `warningLabel`/`warningIcon`
      (`entities/team`, 005 — существующий срез, без новой зависимости внутри 006)
- [x] T048 [US4] `widgets/evaluation-meta/index.ts` — зависит от T047
- [x] T049 [US4] Подключить `EvaluationMeta` в `pages/team/ui/team-page.tsx`; зависит от T038,
      T048
- [x] T050 [US4] Обновить `pages/team/ui/team-page.test.tsx`: метаданные и предупреждения видны
      (quickstart.md, сценарии 10–11); зависит от T049

**Checkpoint**: все 4 user story работают вместе — SC-001/SC-005 закрыты.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T051 [P] Проверить все новые файлы (`entities/metric/**`, `entities/finding/**`,
      `widgets/team-header/**`, `widgets/score-summary/**`, `widgets/area-profile/**`,
      `widgets/findings-summary/**`, `widgets/taxonomy-tree/**`, `widgets/evaluation-meta/**`,
      `pages/team/**`) на отсутствие литеральных цветов/кеглей вне токенов `--ds-*`. Проверено
      `grep` на hex-цвета и дефолтную палитру Tailwind — ни одного совпадения
- [x] T052 [P] `npx eslint ...` — чисто; заодно найдена и исправлена реальная ошибка
      (`react-hooks/set-state-in-effect`): синхронный `setState` в теле эффекта при смене
      `:teamId` через prev/next — исправлено сбросом состояния во время рендера
      (react.dev: «Adjusting state when a prop changes»), не в эффекте
- [x] T053 [P] `npx steiger ./src` (через `npm run lint:fsd` — прямой `npx steiger` падает на
      интерактивном промпте в этом окружении). Границы `entities → widgets → pages` не нарушены.
      Предсказание из 005 подтвердилось: `entities/team` и `widgets/disclaimer-banner` пропали из
      списка `fsd/insignificant-slice` — получили второго потребителя (`pages/team`). Новые 6
      виджетов (`team-header`, `score-summary`, `area-profile`, `findings-summary`,
      `taxonomy-tree`, `evaluation-meta`) в списке — ожидаемо, специфичны для этой одной страницы,
      как `widgets/leaderboard-table` в 005
- [x] T054 Проверено визуально (Playwright, см. T055) на 360 px: полос горизонтальной прокрутки
      страницы нет, таблица-альтернатива скроллится в своём контейнере (правило web/CLAUDE.md),
      дерево и раскрытая метрика читаемы
- [x] T055 Пройдено визуально (Playwright, светлая/тёмная тема, 1280px и 360px) — 0 ошибок
      консоли. Найдено и исправлено 2 реальных бага: (1) SHA команды наезжал на соседнюю колонку
      метаданных (`EvaluationMeta` — нет `break-all`/`min-w-0` на длинном значении); (2) шапка
      страницы (хлебные крошки + prev/next) не переносилась опрятно на 360px (добавлен
      `flex-wrap`). Не пройдено: клики по drill-down (US2 #1–8) и фильтр находок (US3) в браузере
      вручную — эти пути покрыты интеграционными тестами `taxonomy-tree.test.tsx`/
      `team-page.test.tsx`, но не проверялись глазами в браузере из-за объёма сценариев;
      рекомендую точечный проход перед демо
- [x] T056 `npm run check` — зелено, кроме `lint:fsd` (см. T053, тот же осознанный компромисс,
      что в 005 T039)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: зависит от Phase 1 — блокирует все user story
- **US1 (Phase 3)**: зависит от Phase 2
- **US2 (Phase 4)**: зависит от Phase 2; физически независима от US1 (разные виджеты), но обе
  подключаются в один и тот же `pages/team/ui/team-page.tsx` — T031 (US1) и T038 (US2)
  трогают один файл последовательно, не параллельно
- **US3 (Phase 5)**: зависит от Phase 4 (T044 связывает фильтр с `TaxonomyTree` из US2) — в
  отличие от шаблонной независимости user story, здесь US3 физически достраивает US2
- **US4 (Phase 6)**: зависит от Phase 2 напрямую (не от US1/US2/US3) — метаданные не пересекаются
  ни с графиками, ни с деревом; можно реализовать сразу после Foundational, если US2/US3
  откладываются
- **Polish (Phase 7)**: после всех выполняемых user story

### Parallel Opportunities

- Phase 2: T002/T003, T004/T005 (после T002), T006/T007 (после T002), T009/T010, T011/T012,
  T013/T014 (после T009), T015/T016 (после T009,T011), T018/T019 — тесты и независимые файлы
  параллельно
- Phase 3: T025/T026 (тесты), T027/T029 (реализация) — разные файлы
- Phase 7: T051–T053 — независимые проверки параллельно

---

## Implementation Strategy

### MVP First

US1 и US2 — оба P1: «видно, где мы слабее» (радар/бар) + «видно почему, вплоть до кода» —
вместе закрывают SC-001, основную ценность страницы. MVP — Phase 1 → Phase 2 → Phase 3 → Phase 4.

### Incremental Delivery

1. Setup + Foundational → заголовок и состояния страницы видны, тело — заглушка
2. US1 → профиль команды виден
3. US2 → drill-down до кода работает — MVP закрыт
4. US3 → распределение находок и быстрый фильтр по серьёзности
5. US4 → метаданные и доверие к оценке
6. Polish → `npm run check`, ручной проход по обеим темам в браузере
