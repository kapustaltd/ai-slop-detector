# Контракт: пропсы новых компонентов

Публичный API того, что появляется в этой фиче — фиксируется до реализации, чтобы `tasks.md`
резал работу по этим границам, а не изобретал их по ходу.

## `shared/ui/empty-state.tsx` — `EmptyState`

6-й компонент инвентаря (design/reference/screens/09-components-a11y.html: «иконка, заголовок,
причина словами, одно действие»). Используется для: «нет ни одной оценки» (пайплайн ещё не
отработал), «бандл не загрузился» (ошибка), «по фильтрам ничего не найдено».

```ts
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** Пустой набор данных целиком — действия нет, конвейер обновит сам (DESIGN.md, состояние 10). */
  action?: { label: string; onClick: () => void }
  className?: string
}
```

Не принимает `variant`/`tone` — цвет фона/рамки везде нейтральный (`--ds-muted`/`--ds-border`),
тревожного оформления нет ни у одного состояния пустоты (DESIGN.md, «Чего не делать»).

## `entities/team/ui/team-status-badge.tsx` — `TeamStatusBadge`

```ts
interface TeamStatusBadgeProps {
  status: EvaluationStatus // 'done' | 'failed' | 'no_data' | 'running'
  className?: string
}
```

Инкапсулирует связку иконка + текст + токены `--ds-sev-*`/`--ds-warn-*` по статусу. Чистое
отображение, без бизнес-логики.

## `entities/team/ui/team-warning-badges.tsx` — `TeamWarningBadges`

```ts
interface TeamWarningBadgesProps {
  warnings: string[] | undefined
  partial: boolean
  className?: string
}
```

Рендерит 0..N бейджей: «частичная оценка» (если `partial`) + по одному на каждое известное
`warnings[]` значение (текст берётся по словарю причин, неизвестное значение — общий текст
«Предупреждение оценки», не падает и не скрывается).

## `entities/team/model/status.ts`

```ts
function sortValue(team: LeaderboardTeam, key: SortKey): number | null
function sortTeams(teams: LeaderboardTeam[], key: SortKey, direction: SortDirection): LeaderboardTeam[]
function statusLabel(status: EvaluationStatus): string
```

Перенос текущей логики без изменения поведения (тесты `leaderboard-page.test.tsx` фиксируют
контракт `sortTeams` — эквивалентность результата обязательна).

## `widgets/disclaimer-banner/ui/disclaimer-banner.tsx` — `DisclaimerBanner`

```ts
interface DisclaimerBannerProps {
  /** Ссылка «Как считается оценка» — опциональна: на 005 ведёт к легенде рубрики (если есть), на 006 может не быть. */
  rubricHref?: string
}
```

Без пропсов текста — формулировка фиксирована DESIGN.md («Это вспомогательная метрика, а не
вердикт...») и не параметризуется, чтобы не разъехалась между страницами.

## `widgets/leaderboard-table/ui/leaderboard-table.tsx` — `LeaderboardTable`

```ts
interface LeaderboardTableProps {
  teams: LeaderboardTeam[]      // уже отфильтрованные и отсортированные
  sort: SortState
  onSort: (key: SortKey) => void
}
```

Чистое представление: не знает про фильтры и URL, получает готовый список. Рендерит `<table>` на
`md:` и выше; на меньших ширинах скрыт (`hidden md:block`), см. `research.md`.

## `widgets/leaderboard-table/ui/leaderboard-row-card.tsx` — `LeaderboardRowCard`

```ts
interface LeaderboardRowCardProps {
  team: LeaderboardTeam
}
```

Одна карточка мобильного списка (`03-leaderboard-mobile.html`): место+название+итог в одной
строке, backend/frontend — во второй, бейджи — при наличии.

## `widgets/leaderboard-table/ui/leaderboard-toolbar.tsx` — `LeaderboardToolbar`

```ts
interface LeaderboardToolbarProps {
  filters: FilterState
  onFiltersChange: (next: Partial<FilterState>) => void
  shown: number
  total: number
}
```

Без параметра сортировки (десктоп сортирует через заголовки таблицы — см. `research.md`, пункт
«Кнопка «Сортировка: Итог»»); на мобильном сортировка — отдельный `<select>` внутри этого же
тулбара, потому что там нет заголовков колонок.

## `widgets/leaderboard-table/model/use-leaderboard-state.ts` — `useLeaderboardState`

```ts
function useLeaderboardState(index: LeaderboardIndexStub | null): {
  teams: LeaderboardTeam[]        // после fitler+sort
  sort: SortState
  filters: FilterState
  onSort: (key: SortKey) => void
  onFiltersChange: (next: Partial<FilterState>) => void
}
```

Единственное место, читающее/пишущее `useSearchParams` для этой фичи — соответствует
`contracts/url-params.md`.
