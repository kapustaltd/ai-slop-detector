# Tasks: Главная страница — рейтинг команд

**Input**: Design documents from `/specs/005-leaderboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/url-params.md,
contracts/components.md, quickstart.md

**Tests**: включены — принцип VIII конституции требует тестов на каждую фичу; запросы по
роли/тексту (web/CLAUDE.md, правило 3), не по классам.

**Organization**: задачи сгруппированы по user story спеки (US1–US5, приоритеты P1/P1/P2/P2/P3).
US5 заблокирована контрактом (Q13) и оставлена маркером, не реализацией.

## Format: `[ID] [P?] [Story] Description`

Все пути — от `web/src/`, если не указано иное.

---

## Phase 1: Setup

**Purpose**: завести границы FSD-срезов, которых в проекте ещё нет, до того как в них появится код
(web/CLAUDE.md: слои `entities`/`widgets` ещё не заведены).

- [ ] T001 Создать пустые срезы с барабанными `index.ts`-заглушками:
      `web/src/entities/team/index.ts`, `web/src/widgets/leaderboard-table/index.ts`,
      `web/src/widgets/disclaimer-banner/index.ts` — по структуре из `plan.md` → Project Structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: компоненты и логика, на которые опираются все user story ниже.

**⚠️ CRITICAL**: ни одна user story не начинается раньше этой фазы.

- [ ] T002 [P] Реализовать `shared/ui/empty-state.tsx` — пропсы по
      `contracts/components.md#empty-state`: `icon: LucideIcon`, `title: string`,
      `description: string`, `action?: { label; onClick }` опционален (пустой набор данных —
      без action, DESIGN.md состояние 10), нейтральные токены `--ds-muted`/`--ds-border`,
      без тревожного оформления; экспорт через `shared/ui/index.ts`
- [ ] T003 [P] Реализовать `shared/ui/empty-state.test.tsx` — рендер с/без `action`, доступное
      имя по `title`, роль `button` для action
- [ ] T004 [P] Перенести `entities/team/model/status.ts` — `statusLabel(status)`,
      `sortValue(team, key)`, `sortTeams(teams, key, direction)` (из текущего
      `pages/leaderboard/ui/leaderboard-page.tsx`, поведение не меняется: строки с `total === null`
      всегда в хвосте, tie-break `team_id.localeCompare`), плюс словарь подписей `warnings[]` из
      `research.md` («Словарь предупреждений»): `suspected_prompt_injection` → «Влияние на
      оценку», `repo_too_large`/`file_limit_exceeded` → «Лимит размера», `secret_redacted` →
      «Секрет скрыт», `incomplete_area` → «Область оценена частично», `provider_error` → «Ошибка
      модели», неизвестное значение → «Предупреждение оценки»
- [ ] T005 [P] `entities/team/model/status.test.ts` — модульные тесты `sortTeams` (хвост
      `no_data`, стабильный tie-break), `statusLabel` на все 4 статуса, словарь `warnings[]` на
      известное и неизвестное значение
- [ ] T006 [US-foundation] `entities/team/ui/team-status-badge.tsx` — пропсы
      `{ status: EvaluationStatus; className? }` из `contracts/components.md`; токены `--ds-sev-*`
      по статусу; зависит от T004
- [ ] T007 [P] `entities/team/ui/team-warning-badges.tsx` — пропсы
      `{ warnings: string[] | undefined; partial: boolean; className? }`; `partial` → бейдж
      «частичная оценка», по одному бейджу на каждое известное `warnings[]` значение через словарь
      T004; зависит от T004
- [ ] T008 `entities/team/index.ts` — экспорт `status.ts`, `TeamStatusBadge`,
      `TeamWarningBadges` — зависит от T004, T006, T007
- [ ] T009 [P] `widgets/disclaimer-banner/ui/disclaimer-banner.tsx` — фиксированный текст
      DESIGN.md («Это вспомогательная метрика, а не вердикт»...), пропс
      `rubricHref?: string` опционален (`contracts/components.md`)
- [ ] T010 [P] `widgets/disclaimer-banner/ui/disclaimer-banner.test.tsx` +
      `widgets/disclaimer-banner/index.ts` — рендер текста рамки, наличие/отсутствие ссылки

**Checkpoint**: фундамент готов — можно начинать US1.

---

## Phase 3: User Story 1 - Просмотр рейтинга (Priority: P1) 🎯 MVP

**Goal**: таблица команд с местом/названием/итогом/frontend/backend/статусом, отсортированная по
итоговому баллу (как отдаёт бандл), клик по строке ведёт на страницу команды.

**Independent Test**: открыть страницу на фикстурном бандле — порядок и числа соответствуют
`web/data/index.json`, пустая область — прочерк, а не 0 (quickstart.md, сценарии 1–3).

### Tests for User Story 1

- [ ] T011 [P] [US1] `widgets/leaderboard-table/ui/leaderboard-table.test.tsx` — порядок колонок
      место/команда/итог/backend/frontend/статус (FR-001); равные `rank` получают отметку «=»;
      `partial` → дорожка ScoreGauge заштрихована + бейдж; отсутствующая область — прочерк, не «0»
      (FR-006)
- [ ] T012 [P] [US1] `widgets/leaderboard-table/ui/leaderboard-row-card.test.tsx` — карточка:
      место+название+итог в одной строке, backend/frontend во второй (FR-015)

### Implementation for User Story 1

- [ ] T013 [P] [US1] `widgets/leaderboard-table/ui/leaderboard-table.tsx` — десктопная
      `<table>` по композиции `design/reference/screens/01-leaderboard-light.html`: `ScoreGauge`
      (`trackWidth=58`, как в макете) для итог/backend/frontend, `TeamStatusBadge`,
      `TeamWarningBadges`, ссылка на `/team/:teamId` по названию, `<caption>` для скринридера,
      отметка «=» у равных `rank`; статичный `aria-sort` (интерактивность — Phase 5); только
      токены `--ds-*`, литеральных цветов/px нет; зависит от T006, T007
- [ ] T014 [P] [US1] `widgets/leaderboard-table/ui/leaderboard-row-card.tsx` — карточка по
      `design/reference/screens/03-leaderboard-mobile.html`; зависит от T006, T007
- [ ] T015 [US1] `widgets/leaderboard-table/index.ts` — экспорт `LeaderboardTable`,
      `LeaderboardRowCard` — зависит от T013, T014
- [ ] T016 [US1] Переписать `pages/leaderboard/ui/leaderboard-page.tsx`: шапка (заголовок,
      бейдж «внутренний инструмент жюри», время сборки бандла из `built_at`), `DisclaimerBanner`,
      `LeaderboardTable` (`hidden md:block`) + список `LeaderboardRowCard` (`md:hidden`) на
      `index.teams` без сортировки/фильтров (default-порядок из бандла); убрать текущую вёрстку
      на дефолтах shadcn (`max-w-6xl`, `Table`/`Badge`/`Button` без токенов); зависит от T008,
      T010, T015
- [ ] T017 [US1] Обновить `pages/leaderboard/ui/leaderboard-page.test.tsx` под новую разметку:
      переход по клику на команду ведёт на `/team/<team_id>` (FR-010), запросы по роли/тексту;
      зависит от T016

**Checkpoint**: US1 работает и тестируется независимо.

---

## Phase 4: User Story 2 - Видимость статусов и флагов (Priority: P1)

**Goal**: статус и предупреждения видны и объяснены без перехода в команду; `failed` и `no_data`
визуально не спутать с низким баллом.

**Independent Test**: фикстура со всеми 4 статусами + предупреждениями — наведение на бейдж даёт
пояснение (quickstart.md, сценарий 4).

### Tests for User Story 2

- [ ] T018 [P] [US2] `entities/team/ui/team-status-badge.test.tsx` — доступное пояснение на
      каждый статус; для `failed` — текст «оценка не удалась — подробности на странице команды»
      (research.md: индекс бандла не содержит причины, только страница команды — 006)
- [ ] T019 [P] [US2] `entities/team/ui/team-warning-badges.test.tsx` — пояснение на известное
      значение `warnings[]` и на неизвестное (fallback «Предупреждение оценки»)

### Implementation for User Story 2

- [ ] T020 [US2] Дополнить `entities/team/ui/team-status-badge.tsx` доступным описанием
      (`title` + `aria-describedby`) по статусу; зависит от T006
- [ ] T021 [US2] Дополнить `entities/team/ui/team-warning-badges.tsx` подсказкой по словарю
      T004 на каждый бейдж; зависит от T007
- [ ] T022 [US2] Обновить `pages/leaderboard/ui/leaderboard-page.test.tsx`: команда без оценки
      показывает прочерк, а не 0 (FR-006, US2 #2); команда `failed` — бейдж с доступным пояснением
      (US2 #3); зависит от T016, T020, T021

**Checkpoint**: US1 + US2 — рейтинг читаем без перехода в карточку команды.

---

## Phase 5: User Story 3 - Сортировка и фильтры (Priority: P2)

**Goal**: сортировка по каждой числовой колонке, фильтр по статусу и по предупреждениям, состояние
в адресе (`contracts/url-params.md`), пустой результат фильтра — с кнопкой сброса.

**Independent Test**: quickstart.md, сценарии 5–8.

### Tests for User Story 3

- [ ] T023 [P] [US3] `widgets/leaderboard-table/model/use-leaderboard-state.test.ts` —
      сортировка по умолчанию (`sort=rank`), переключение направления, комбинации фильтров,
      неизвестное значение параметра → значение по умолчанию (не ошибка), round-trip через URL
      (`contracts/url-params.md`)
- [ ] T024 [P] [US3] `widgets/leaderboard-table/ui/leaderboard-toolbar.test.tsx` — переключение
      фильтра статуса и предупреждений, счётчик «Показано: N из M» обновляется через
      `aria-live="polite"` (DESIGN.md, «Числа»)

### Implementation for User Story 3

- [ ] T025 [US3] `widgets/leaderboard-table/model/use-leaderboard-state.ts` — хук по
      `contracts/components.md#useLeaderboardState`: читает/пишет `useSearchParams` по контракту
      `contracts/url-params.md` (параметры `sort`, `dir`, `status`, `warnings`; удаление параметра
      при возврате к значению по умолчанию); использует `sortTeams`/`sortValue` из T004; зависит
      от T004
- [ ] T026 [US3] Добавить в `widgets/leaderboard-table/ui/leaderboard-table.tsx`
      кликабельные/клавиатурно-доступные заголовки колонок (`aria-sort`, обработчик `onSort`) —
      FR-007; зависит от T013, T025
- [ ] T027 [US3] `widgets/leaderboard-table/ui/leaderboard-toolbar.tsx` — `<select>` статуса,
      чекбокс «только с предупреждениями», счётчик показанных, на мобильном — дополнительный
      `<select>` сортировки (research.md: десктопный дублирующий dropdown не собирается, заголовки
      колонок уже закрывают FR-007); зависит от T025
- [ ] T028 [US3] `widgets/leaderboard-table/index.ts` — добавить экспорт
      `LeaderboardToolbar`, `useLeaderboardState` — зависит от T025, T027
- [ ] T029 [US3] Подключить в `pages/leaderboard/ui/leaderboard-page.tsx`
      `useLeaderboardState` + `LeaderboardToolbar` вместо статичного порядка из T016; пустой
      результат фильтрации — `EmptyState` (T002) с действием «Сбросить фильтры» (US3 #4); зависит
      от T016, T028, T002
- [ ] T030 [US3] Обновить `pages/leaderboard/ui/leaderboard-page.test.tsx`: сортировка по
      backend/frontend переупорядочивает строки без изменения `rank` (US3 #1), фильтр
      предупреждений сохраняется в адресе и переживает перемонтирование через `initialEntries`
      (US3 #2, #3), пустой результат фильтра показывает `EmptyState` со сбросом (US3 #4); зависит
      от T029

**Checkpoint**: сортировка/фильтры интерактивны, ссылка с состоянием воспроизводима.

---

## Phase 6: User Story 4 - Состояния страницы (Priority: P2)

**Goal**: «данных ещё нет» и «ошибка загрузки бандла» — различимые состояния через `EmptyState`,
без скелетонов/спиннеров (research.md).

**Independent Test**: quickstart.md, сценарий 9 + пустой бандл целиком.

### Tests for User Story 4

- [ ] T031 [P] [US4] Обновить `pages/leaderboard/ui/leaderboard-page.test.tsx`: ошибка чтения
      бандла → `EmptyState` с действием «Повторить» (US4 #3); пустой бандл (`teams.length === 0`)
      → `EmptyState` **без** action (DESIGN.md, состояние 10 — «конвейер обновит страницу сам»),
      что отличает его от пустого результата фильтра из T030 (там action есть)

### Implementation for User Story 4

- [ ] T032 [US4] В `pages/leaderboard/ui/leaderboard-page.tsx` заменить текущий
      `<p role="alert">` + `<Button>` веткой `EmptyState` (иконка ошибки, «Не удалось загрузить
      дата-бандл», описание, action «Повторить» → существующий `load()`); зависит от T029, T002
- [ ] T033 [US4] В `pages/leaderboard/ui/leaderboard-page.tsx` добавить ветку «данных ещё нет»
      (`index.teams.length === 0`, отличается от «результат фильтра пуст» из T029 — это про сам
      бандл, не про фильтры): `EmptyState` без action; зависит от T029, T002

**Checkpoint**: SC-003 — все состояния (нет данных, ошибка, пустой фильтр, готово) различимы и
покрыты тестами.

---

## Phase 7: User Story 5 - Мини-спарклайны (Priority: P3) — ЗАБЛОКИРОВАНО

**Goal (по спеке)**: компактный профиль баллов по категориям в строке рейтинга.

- [ ] T034 [US5] **Не реализуется в этой фиче.** `LeaderboardIndexBundle.teams[].areas` содержит
      только `{backend, frontend}` — по одному числу на область, не разбивку по категориям;
      профиль по категориям есть только в файле команды (`TeamBundle`), которого рейтинг не
      загружает (004 FR-003 запрещает тянуть в индекс лишнее без необходимости). Заблокировано
      Q13 (`docs/open-questions.md`). При появлении ответа — новая задача на
      `entities/team/ui/team-category-sparkline.tsx`, подключается в T013/T014 последним, первым
      вырезаемым элементом при нехватке времени (FR-014, SHOULD).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: финальная проверка соответствия дизайн-системе и гейтам качества.

- [ ] T035 [P] Проверить `pages/leaderboard/ui/leaderboard-page.tsx`,
      `widgets/leaderboard-table/**`, `widgets/disclaimer-banner/**`,
      `entities/team/**`, `shared/ui/empty-state.tsx` на отсутствие литеральных цветов/кеглей вне
      токенов `--ds-*` (web/CLAUDE.md, правило 4 раздела «Интерфейс»)
- [ ] T036 [P] `npx eslint src/entities/team src/widgets/leaderboard-table
      src/widgets/disclaimer-banner src/pages/leaderboard src/shared/ui/empty-state.tsx` — без
      предупреждений
- [ ] T037 [P] `npx steiger ./src` — границы `entities → widgets → pages` не нарушены, срезы не
      импортируют друг друга внутри слоя
- [ ] T038 Вручную пройти `quickstart.md` (сценарии 1–10) в обеих темах и на ширине 360 px —
      визуальная проверка, не автоматизируется
- [ ] T039 `npm run check` — полный гейт перед тем, как предлагать коммит

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: без зависимостей
- **Foundational (Phase 2)**: зависит от Phase 1 — блокирует все user story
- **US1 (Phase 3)**: зависит от Phase 2
- **US2 (Phase 4)**: зависит от Phase 3 (расширяет `TeamStatusBadge`/`TeamWarningBadges` и
  разметку страницы из US1, а не только от Foundational) — в отличие от типового шаблона, US1 и
  US2 здесь не полностью независимы: оба P1, и US2 физически достраивает то, что вывела на экран
  US1
- **US3 (Phase 5)**: зависит от Phase 3 (добавляет интерактивность к статичной таблице US1);
  независима от US2
- **US4 (Phase 6)**: зависит от Phase 5 (композиция страницы к этому моменту уже включает
  `useLeaderboardState`/`LeaderboardToolbar` из US3); при необходимости можно реализовать сразу
  после Phase 3, если US3 откладывается — состояния «нет данных»/«ошибка» не используют фильтры
- **US5 (Phase 7)**: заблокирована, не выполняется
- **Polish (Phase 8)**: после всех выполняемых user story

### Parallel Opportunities

- Phase 2: T002/T003, T004/T005, T007, T009/T010 — разные файлы, можно параллельно после T004
  (T006–T008 зависят от T004)
- Phase 3: T011/T012 (тесты) и T013/T014 (реализация) — параллельно попарно; T013 и T014 не делят
  файлов
- Phase 8: T035–T037 — независимые проверки, параллельно

---

## Implementation Strategy

### MVP First

Спека помечает P1 обе истории — US1 и US2. MVP — Phase 1 → Phase 2 → Phase 3 → Phase 4
(«рейтинг виден и статусы понятны без перехода в карточку команды»). US3/US4 — следующий инкремент
(рабочий инструмент жюри и устойчивость к пустым/ошибочным данным), US5 не входит.

### Incremental Delivery

1. Setup + Foundational → компоненты готовы, страница ещё не собрана
2. US1 → таблица/карточки видны, статичный порядок — можно показать
3. US2 → бейджи объяснены — MVP закрыт
4. US3 → интерактивная сортировка/фильтры, ссылки
5. US4 → устойчивость к пустому/битому бандлу
6. Polish → `npm run check` перед тем, как предлагать коммит
