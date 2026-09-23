# Data Model: 005-leaderboard

Все сущности — проекции уже сгенерированных типов (`web/src/shared/api/generated/data-bundle.ts`
→ реэкспорт в `web/src/shared/api/bundle.ts`). Новых полей не вводится (принцип IX: руками
дублировать контракт нельзя). Ниже — только то, что UI-слой держит поверх контракта: производные
представления и локальное состояние экрана.

## LeaderboardTeam (из контракта, без изменений)

Источник: `LeaderboardIndexBundle['teams'][number]`.

| Поле | Тип | UI-семантика |
|---|---|---|
| `team_id` | `string` | ключ строки, slug в ссылке `/team/:teamId`, tie-break сортировки |
| `name` | `string` | название команды, усекается по ширине колонки (edge case: длинное имя) |
| `rank` | `number \| null` | `null` → «нет данных», ранг не присваивается |
| `total` | `number \| null` | `null` → прочерк, не 0 |
| `areas` | `{[area]: number}` | ключи `backend`/`frontend`; отсутствующий ключ ≠ `0`, а «нет данных» |
| `status` | `'done' \| 'failed' \| 'no_data' \| 'running'` | определяет бейдж статуса и группу в сортировке (нет-данных/failed — в конец) |
| `warnings` | `string[]?` | наличие непустого массива → бейдж «есть предупреждения» |
| `partial` | `boolean` | true → бейдж «частичная оценка», дорожка ScoreGauge заштрихована |

## Производные представления (вычисляются в UI, не хранятся, не пишутся в бандл)

### `TeamStatusView` (entities/team/model)

Чистая функция `LeaderboardTeam['status'] → { label: string; tone: StatusTone }`, где `StatusTone`
— замкнутый union `'done' | 'failed' | 'no_data' | 'running'`, используемый только для выбора
токенов `--ds-sev-*`/`--ds-warn-*`, не для новой бизнес-логики.

### `SortState` (widgets/leaderboard-table/model)

```ts
type SortKey = 'rank' | 'total' | 'backend' | 'frontend'
type SortDirection = 'asc' | 'desc'
interface SortState { key: SortKey; direction: SortDirection }
```

Сериализуется в `?sort=<key>&dir=<direction>` (см. `contracts/url-params.md`). Хранится только в
URL через `useSearchParams` — нет отдельного React state, который может разойтись со ссылкой
(FR-009: состояние обязано быть в адресе).

### `FilterState`

```ts
interface FilterState {
  status: EvaluationStatus | 'all'
  warningsOnly: boolean
}
```

Тоже только в URL (`?status=<value>&warnings=1`).

### Сортировка с равными баллами (FR-004)

Детерминированный tie-break: при равенстве значения по активной колонке — сравнение по
`team_id.localeCompare(...)`. Место (`rank`) не пересчитывается UI-слоем никогда (принцип VI) —
`rank` берётся из бандла как есть и используется только для отображения «=» у равных мест и для
хвостовой сортировки `no_data`.

### Правило хвоста при сортировке (DESIGN.md, «Нет данных»)

Строки с `total === null` (и, соответственно, `rank === null`) остаются в конце списка независимо
от направления сортировки — это уже реализовано в `sortTeams` текущего кода (`leftValue == null →
1`), переносится как есть в `entities/team/model/status.ts`.

## Состояние страницы (Key Entity спеки, «Состояние таблицы»)

Не заводится отдельный тип — состояние полностью описывается `SortState + FilterState` (оба в URL)
плюс `index: LeaderboardIndexStub | null` (загружен/не загружен) и `isLoading: boolean` (используется
только веткой retry после ошибки — см. research.md).
