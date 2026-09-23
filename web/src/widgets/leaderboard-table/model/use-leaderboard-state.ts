import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { sortTeams, type SortDirection, type SortKey } from '@/entities/team'
import type { EvaluationStatus, LeaderboardIndexStub, LeaderboardTeam } from '@/shared/api'

/**
 * Единственное место, читающее/пишущее `useSearchParams` для рейтинга — контракт
 * `contracts/url-params.md`. Неизвестное/невалидное значение параметра трактуется как значение по
 * умолчанию, а не как ошибка. Возврат к значению по умолчанию удаляет параметр из адреса.
 */

const SORT_KEYS: SortKey[] = ['rank', 'total', 'backend', 'frontend']
const STATUS_VALUES: EvaluationStatus[] = ['done', 'failed', 'no_data', 'running']

export interface FilterState {
  status: EvaluationStatus | 'all'
  warningsOnly: boolean
}

export interface SortState {
  key: SortKey
  direction: SortDirection
}

function parseSortKey(value: string | null): SortKey {
  return value != null && (SORT_KEYS as string[]).includes(value) ? (value as SortKey) : 'rank'
}

function parseDirection(value: string | null, key: SortKey): SortDirection {
  if (value === 'asc' || value === 'desc') return value
  return key === 'rank' ? 'asc' : 'desc'
}

function parseStatus(value: string | null): EvaluationStatus | 'all' {
  return value != null && (STATUS_VALUES as string[]).includes(value)
    ? (value as EvaluationStatus)
    : 'all'
}

export function useLeaderboardState(index: LeaderboardIndexStub | null) {
  const [searchParams, setSearchParams] = useSearchParams()

  const sort: SortState = {
    key: parseSortKey(searchParams.get('sort')),
    direction: parseDirection(searchParams.get('dir'), parseSortKey(searchParams.get('sort'))),
  }
  const filters: FilterState = {
    status: parseStatus(searchParams.get('status')),
    warningsOnly: searchParams.get('warnings') === '1',
  }

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const onSort = (key: SortKey) => {
    if (sort.key === key) {
      updateParams({ dir: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({
        sort: key === 'rank' ? null : key,
        dir: key === 'rank' ? null : 'desc',
      })
    }
  }

  const onFiltersChange = (next: Partial<FilterState>) => {
    const updates: Record<string, string | null> = {}
    if ('status' in next) updates.status = next.status === 'all' ? null : (next.status ?? null)
    if ('warningsOnly' in next) updates.warnings = next.warningsOnly ? '1' : null
    updateParams(updates)
  }

  const teams = useMemo<LeaderboardTeam[]>(() => {
    const filtered = (index?.teams ?? []).filter((team) => {
      const matchesStatus = filters.status === 'all' || team.status === filters.status
      const matchesWarnings = !filters.warningsOnly || (team.warnings?.length ?? 0) > 0
      return matchesStatus && matchesWarnings
    })
    return sortTeams(filtered, sort.key, sort.direction)
  }, [index, filters.status, filters.warningsOnly, sort.key, sort.direction])

  return { teams, total: index?.teams.length ?? 0, sort, filters, onSort, onFiltersChange }
}
