import type { SortDirection, SortKey } from '@/entities/team'
import type { EvaluationStatus } from '@/shared/api'

import { MOBILE_SORT_OPTIONS, STATUS_OPTIONS } from '../model/columns'
import type { FilterState } from '../model/use-leaderboard-state'

/**
 * Фильтры и счётчик показанных строк. Сортировка десктопа — клики по заголовкам таблицы
 * (`LeaderboardTable`); здесь только `<select>` сортировки для мобильного, где заголовков нет
 * (research.md: дублирующий dropdown на десктопе не собираем — FR-007 уже закрыт заголовками).
 */

export interface LeaderboardToolbarProps {
  filters: FilterState
  onFiltersChange: (next: Partial<FilterState>) => void
  sort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
  shown: number
  total: number
}

export function LeaderboardToolbar({
  filters,
  onFiltersChange,
  sort,
  onSort,
  shown,
  total,
}: LeaderboardToolbarProps) {
  return (
    <section aria-label="Фильтры рейтинга" className="flex flex-wrap items-center gap-3">
      <label className="flex h-9 items-center gap-2 text-[15px]">
        <span className="sr-only">Статус оценки</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ status: event.target.value as EvaluationStatus | 'all' })
          }
          className="h-9 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-fg"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex h-9 items-center gap-2 text-[15px] text-fg">
        <input
          type="checkbox"
          checked={filters.warningsOnly}
          onChange={(event) => onFiltersChange({ warningsOnly: event.target.checked })}
        />
        Только с предупреждениями
      </label>

      <label className="flex h-9 items-center gap-2 text-[15px] md:hidden">
        <span className="sr-only">Сортировка</span>
        <select
          value={sort.key}
          onChange={(event) => onSort(event.target.value as SortKey)}
          className="h-9 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-fg"
        >
          {MOBILE_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Сортировка: {option.label}
            </option>
          ))}
        </select>
      </label>

      <span className="ml-auto text-[14.5px] text-fg-subtle" aria-live="polite">
        Показано: {shown} из {total}
      </span>
    </section>
  )
}
