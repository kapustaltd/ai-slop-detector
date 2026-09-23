# Контракт: пропсы новых компонентов

## `entities/metric/ui/taxonomy-row.tsx` — `TaxonomyRow`

DESIGN.md: «строка узла одинакова на всех трёх уровнях; уровень задаёт отступ, кегль и толщину
дорожки». Один компонент, три уровня через проп `level`.

```ts
interface TaxonomyRowProps {
  level: 1 | 2 | 3; // категория | подкатегория | метрика
  name: string;
  weight: number; // вес внутри родителя (0..1)
  score: number | null;
  contribution?: { value: number; ofTotal: number }; // «вклад 1.55 из 8.20» — только уровни 1–2
  findingsCount?: number; // только уровни 1–2 («5 находок»)
  confidence?: "high" | "medium" | "low"; // только уровень 3
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}
```

Рендерит `ScoreGauge` (переиспользуется из 005) внутри строки — не переизобретает дорожку/цвет
баллов. `confidence === 'low'` — пунктирная рамка строки + индикатор из трёх точек (DESIGN.md,
«Метрика в раскрытом виде»), не влияет на цвет самого балла.

## `entities/metric/ui/anchor-scale.tsx` — `AnchorScale`

```ts
interface AnchorScaleProps {
  anchors: { "2": string; "5": string; "8": string; "10": string }; // RubricMetric.anchors
  score: number;
  className?: string;
}
```

Четыре якоря списком с числовыми маркерами + отметка фактического балла между ними
(`anchorPosition()`, `entities/metric/model/contribution.ts`). Текст «инструмент поставил N»
вставляется между якорями по значению, не приклеивается сверху (DESIGN.md).

## `entities/finding/ui/finding-card.tsx` — `FindingCard`

```ts
interface FindingCardProps {
  finding: FindingView;
  density: "summary" | "expanded"; // строка (бейдж+заголовок+путь) | раскрытая (объяснение+код+рекомендация)
  permalinkBase?: string; // SHA для «Открыть на <sha>»
  onToggle?: () => void; // summary → expanded по клику
  className?: string;
}
```

Три состояния ссылки — `linkState()` (`entities/finding/model/link-state.ts`, см. research.md).
Рекомендация — только для `kind === 'issue'` с непустым `suggestion`, отдельным блоком с левой
линейкой (DESIGN.md). Снипет — через `useHighlightedSnippet` (`entities/finding/model/highlight-
snippet.ts`), сворачиваемый при длинных фрагментах (Edge Case спеки).

## `entities/finding/ui/severity-bar.tsx` — `SeverityBar`

```ts
interface SeverityBarProps {
  counts: Record<"info" | "minor" | "major" | "critical", number>;
  activeSeverity: "all" | "info" | "minor" | "major" | "critical";
  onSelect: (severity: "all" | "info" | "minor" | "major" | "critical") => void;
  className?: string;
}
```

Сегменты — настоящие `button` с `aria-label` (DESIGN.md: «не Recharts, потому что сегменты должны
быть button»), не canvas/svg-график. Повторный клик по активному сегменту снимает фильтр
(`onSelect('all')`).

## `widgets/team-header/ui/team-header.tsx` — `TeamHeader`

```ts
interface TeamHeaderProps {
  team: TeamBundle;
  rankContext: TeamRankContext; // data-model.md — rank/tiedWith/prev/next, может быть пустым
}
```

Хлебные крошки «Рейтинг / «Название команды»», статус (`TeamStatusBadge`, переиспользуется из
005), ссылка на репозиторий+SHA+ветка, prev/next по `rankContext` (скрыты, если `rankContext`
пуст — team page открыта напрямую).

## `widgets/score-summary/ui/score-summary.tsx` — `ScoreSummary`

```ts
interface ScoreSummaryProps {
  team: TeamBundle;
}
```

Итог + по одной карточке на присутствующую область (`ScoreGauge`, размер `hero`/`large` — 005).
Область со статусом `no_data`/`failed` — карточка с прочерком, не с 0 (принцип VI, FR-006 из 005
переносится сюда тем же способом).

## `widgets/area-profile/ui/area-profile.tsx` — `AreaProfile`

```ts
interface AreaProfileProps {
  areaName: "backend" | "frontend";
  area: TeamArea;
  stats?: StatsBundle["areas"][number]; // может отсутствовать/insufficient_data
}
```

Radar (recharts, перенос текущей реализации) + bar-vs-среднее + текстовая таблица-альтернатива
(FR-006: графики обязаны иметь текстовую альтернативу) — таблица всегда развёрнута, не под кнопкой
(DESIGN.md, «Графики»). При `stats.insufficient_data` — сравнение не рисуется вовсе, есть текст с
порогом; профиль команды (radar) остаётся.

## `widgets/findings-summary/ui/findings-summary.tsx` — `FindingsSummary`

```ts
interface FindingsSummaryProps {
  counts: { strength: number; issue: number } & Record<
    "info" | "minor" | "major" | "critical",
    number
  >;
  filter: FindingsFilter;
  onFilterChange: (next: Partial<FindingsFilter>) => void;
}
```

Композиция `SeverityBar` + счётчики; клик по сегменту — `onFilterChange({ severity })`.

## `widgets/taxonomy-tree/ui/taxonomy-tree.tsx` — `TaxonomyTree`

```ts
interface TaxonomyTreeProps {
  areaName: "backend" | "frontend";
  area: TeamArea;
  rubric?: RubricBundle;
  path: TaxonomyPath;
  onPathChange: (next: TaxonomyPath) => void;
  findingsFilter: FindingsFilter;
  activeFindingSlug?: string;
}
```

Композиция `TaxonomyRow` (категория/подкатегория) + на листе — `AnchorScale` + `FindingCard[]`
(метрика). Раскрытые узлы хранятся независимо, поэтому открытие соседнего узла не
схлопывает предыдущий. `TaxonomyPath` продолжает описывать активную ветку для URL; «Свернуть всё»
очищает и локальные состояния, и `node` активной ветки.

## `widgets/evaluation-meta/ui/evaluation-meta.tsx` — `EvaluationMeta`

```ts
interface EvaluationMetaProps {
  team: TeamBundle;
  permalinkBase?: string; // SHA → ссылка на коммит (FR-017 #2)
}
```

Commit/рубрика/модель/время + `warnings[]` (переиспользует словарь `warningLabel` из
`entities/team`, 005 — тот же контракт 001, тот же список значений).
