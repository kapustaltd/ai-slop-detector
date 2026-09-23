# Data Model: 006-team-details

Как и в 005: сущности спеки — проекции сгенерированных типов
(`web/src/shared/api/generated/data-bundle.ts` → `shared/api/bundle.ts`). Новых полей не вводится.

## Соответствие Key Entities спеки → типы контракта

| Key Entity (spec.md) | Тип контракта | Примечание |
|---|---|---|
| Профиль команды (TeamProfile) | `TeamBundle` | `loadTeam(teamId)` — асинхронно, отдельный чанк (008 FR) |
| Узел таксономии (TaxonomyNode) | `TeamCategory` \| `TeamSubcategory` | `id`, `name`, `weight`, `score`, дочерние узлы — уже в контракте, ничего не добавляется |
| Блок метрики (MetricPanel) | `TeamMetric` | `score`, `summary`, `rationale`, `confidence`, `findings[]`; описание+якоря — из `RubricMetric` (`loadRubric`) по `id` |
| Отображаемая находка (FindingView) | `TeamFinding` (реэкспортирован как `FindingView` в `shared/api`) | `kind`, `severity`, `file`, `line_start`, `line_end`, `title`, `explanation`, `suggestion?`, `link_status?`, `snippet?`, `permalink?` |
| Метаданные оценки (EvaluationMeta) | `TeamMeta` (`team.meta`) | `schema_version`, `skill_version`, `rubric_version`, `model`, `evaluated_at`; `commit_sha`/`warnings`/`partial` — на уровне `TeamBundle`, не `TeamMeta` |

## Производные представления (вычисляются в UI, не хранятся)

### `LinkState` (entities/finding/model/link-state.ts)

```ts
type LinkState = 'verified' | 'unverified' | 'no-permalink'
function linkState(finding: FindingView): LinkState
```

См. research.md «Три состояния ссылки». Чистая функция от `link_status`/`permalink`.

### `FindingSlug` (entities/finding/model)

```ts
function findingSlug(finding: FindingView): string  // `${file}:${line_start}-${line_end}`
```

Используется и как React `key`, и как значение URL-параметра `finding` (см.
`contracts/url-params.md`).

### `AnchorPosition` (entities/metric/model/contribution.ts)

```ts
function anchorPosition(score: number): number  // 0–100, кусочно-линейно по [0,2,5,8,10]
```

### `TaxonomyPath` (widgets/taxonomy-tree/model)

```ts
interface TaxonomyPath {
  area: 'backend' | 'frontend'
  categoryId?: string
  subcategoryId?: string
  metricId?: string
}
```

Разобранное состояние `?area=&node=` (контракт `contracts/url-params.md`) — что раскрыто. `node`
хранит `categoryId.subcategoryId.metricId` (частично, до нужной глубины) единой строкой с точкой в
качестве разделителя — так же, как в `id` метрики в макете (`security.authz.resource-level`).

### `FindingsFilter` (widgets/findings-summary/model, переиспользуется taxonomy-tree)

```ts
interface FindingsFilter {
  kind: 'all' | 'strength' | 'issue'
  severity: 'all' | 'info' | 'minor' | 'major' | 'critical'
}
```

Перенос уже существующей логики (`kindFilter`/`severityFilter` в текущем `team-page.tsx`) без
изменения поведения.

### `TeamRankContext` (pages/team/model или widgets/team-header/model)

```ts
interface TeamRankContext {
  rank: number | null
  totalTeams: number
  tiedWith: string[]       // названия команд с тем же rank, если есть
  previousTeamId: string | null
  nextTeamId: string | null
}
```

Вычисляется из `getLeaderboardIndex()` (005) по `team_id` текущей страницы — см. research.md
«Место в рейтинге и prev/next». Возвращает `null`/пустые значения, если индекс недоступен или
команда не найдена в нём (открыта по прямой ссылке) — не бросает и не блокирует остальную
страницу.

## Состояние страницы (FR-020)

Те же 4 состояния, что в текущей реализации (`PageState = 'loading' | 'ready' | 'missing' |
'error'`), плюс различение «нет данных по области» на уровне `TeamArea.status` внутри `ready`
(уже есть в контракте: `status: 'done' | 'failed' | 'no_data' | 'running'` на каждую область
отдельно — Edge Case спеки «команда оценена только по одной области»).
