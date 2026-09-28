import { ArrowDownUp, Search } from 'lucide-react'
import type { ReactNode } from 'react'

import type { LeaderboardStatus, SortDirection, SortKey } from '@/entities/team'

import { MOBILE_SORT_OPTIONS, STATUS_OPTIONS } from '../model/columns'
import type { FilterState } from '../model/use-leaderboard-state'

/**
 * Фильтры и счётчик показанных строк. Сортировка десктопа — клики по заголовкам таблицы
 * (`LeaderboardTable`); здесь `<select>` и направление сортировки для компактной карточной версии.
 * На десктопе отдельный dropdown не нужен: FR-007 уже закрыт заголовками таблицы.
 */

export interface LeaderboardToolbarProps {
  filters: FilterState
  onFiltersChange: (next: Partial<FilterState>) => void
  sort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
  shown: number
  total: number
  action?: ReactNode
}

export function LeaderboardToolbar({
  filters,
  onFiltersChange,
  sort,
  onSort,
  shown,
  total,
  action,
}: LeaderboardToolbarProps) {
  const hasActiveFilters =
    filters.status !== 'all' || filters.warningsOnly || filters.query.trim() !== ''

  return (
    <section
      aria-label="Фильтры рейтинга"
      className="leaderboard-toolbar flex flex-wrap items-center gap-3"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-[15px] xl:min-h-10">
          <span className="sr-only">Статус оценки</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ status: event.target.value as LeaderboardStatus | 'all' })
            }
            className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-fg xl:min-h-10"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative flex min-h-11 min-w-[220px] flex-1 items-center xl:min-h-10 xl:max-w-[280px]">
          <Search
            aria-hidden="true"
            size={16}
            className="pointer-events-none absolute left-3 text-fg-subtle"
          />
          <span className="sr-only">Поиск команды</span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ query: event.target.value })}
            placeholder="Поиск команды"
            aria-label="Поиск команды"
            className="min-h-11 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-[15px] text-fg placeholder:text-fg-subtle xl:min-h-10"
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 text-[15px] text-fg xl:min-h-10">
          <input
            type="checkbox"
            checked={filters.warningsOnly}
            onChange={(event) => onFiltersChange({ warningsOnly: event.target.checked })}
          />
          Только с предупреждениями
        </label>

        <label className="flex min-h-11 items-center gap-2 text-[15px] xl:hidden">
          <span className="sr-only">Сортировка</span>
          <select
            value={sort.key}
            onChange={(event) => onSort(event.target.value as SortKey)}
            className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-fg"
          >
            {MOBILE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Сортировка: {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          aria-label={`Направление сортировки: ${sort.direction === 'asc' ? 'по возрастанию' : 'по убыванию'}. Изменить`}
          title={sort.direction === 'asc' ? 'По возрастанию' : 'По убыванию'}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-[15px] text-fg xl:hidden"
          onClick={() => onSort(sort.key)}
        >
          <ArrowDownUp aria-hidden="true" size={16} />
          {sort.direction === 'asc' ? 'По возрастанию' : 'По убыванию'}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {hasActiveFilters ? (
          <span className="text-[14.5px] text-fg-muted" aria-live="polite">
            Показано: {shown} из {total}
          </span>
        ) : null}
        {action}
      </div>
    </section>
  )
}
