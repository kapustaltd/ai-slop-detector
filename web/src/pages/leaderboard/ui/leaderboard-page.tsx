import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  getLeaderboardIndex,
  type EvaluationStatus,
  type LeaderboardIndexStub,
  type LeaderboardTeam,
} from '@/shared/api'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

type SortKey = 'rank' | 'total' | 'frontend' | 'backend'

const statusLabels: Record<EvaluationStatus, string> = {
  done: 'Готово',
  failed: 'Ошибка',
  no_data: 'Нет данных',
  running: 'Выполняется',
}

const statusVariants: Record<
  EvaluationStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  done: 'default',
  failed: 'destructive',
  no_data: 'outline',
  running: 'secondary',
}

function score(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(1)
}

function status(value: string): EvaluationStatus {
  return value in statusLabels ? (value as EvaluationStatus) : 'no_data'
}

function sortValue(team: LeaderboardTeam, key: SortKey): number | null {
  if (key === 'rank') return team.rank
  if (key === 'total') return team.total
  return team.areas?.[key] ?? null
}

function sortTeams(teams: LeaderboardTeam[], key: SortKey, direction: 'asc' | 'desc') {
  return [...teams].sort((left, right) => {
    const leftValue = sortValue(left, key)
    const rightValue = sortValue(right, key)
    if (leftValue == null && rightValue != null) return 1
    if (leftValue != null && rightValue == null) return -1
    if (leftValue != null && rightValue != null && leftValue !== rightValue) {
      return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
    }
    return left.team_id.localeCompare(right.team_id)
  })
}

function readIndex() {
  try {
    return getLeaderboardIndex()
  } catch {
    return null
  }
}

function SortButton({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean
  direction: 'asc' | 'desc'
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="rounded px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
    >
      {label} {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
    </button>
  )
}

function LeaderboardTable({
  teams,
  sortKey,
  direction,
  onSort,
}: {
  teams: LeaderboardTeam[]
  sortKey: SortKey
  direction: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const header = (key: SortKey, label: string) => (
    <TableHead
      aria-sort={sortKey === key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <SortButton
        active={sortKey === key}
        direction={direction}
        label={label}
        onClick={() => onSort(key)}
      />
    </TableHead>
  )

  return (
    <Table>
      <caption className="sr-only">Рейтинг команд</caption>
      <TableHeader>
        <TableRow>
          {header('rank', 'Место')}
          <TableHead>Команда</TableHead>
          {header('total', 'Итог')}
          {header('frontend', 'Frontend')}
          {header('backend', 'Backend')}
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((team) => {
          const teamStatus = status(team.status)
          const warnings = team.warnings ?? []
          return (
            <TableRow key={team.team_id}>
              <TableCell className="font-medium">{team.rank ?? '—'}</TableCell>
              <TableCell>
                <Link
                  className="font-medium underline-offset-4 hover:underline"
                  to={`/team/${team.team_id}`}
                >
                  {team.name}
                </Link>
                {team.partial && (
                  <Badge className="ml-2" variant="outline">
                    Частичная оценка
                  </Badge>
                )}
                {warnings.length > 0 && (
                  <Badge className="ml-2" variant="destructive">
                    Есть предупреждения
                  </Badge>
                )}
              </TableCell>
              <TableCell className="font-semibold tabular-nums">{score(team.total)}</TableCell>
              <TableCell className="tabular-nums">{score(team.areas?.frontend)}</TableCell>
              <TableCell className="tabular-nums">{score(team.areas?.backend)}</TableCell>
              <TableCell>
                <Badge variant={statusVariants[teamStatus]}>{statusLabels[teamStatus]}</Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function LeaderboardPage() {
  const [index, setIndex] = useState<LeaderboardIndexStub | null>(readIndex)
  const [isLoading, setIsLoading] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const sortKey = (searchParams.get('sort') as SortKey | null) ?? 'rank'
  const direction = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const statusFilter = searchParams.get('status') ?? 'all'
  const warningsOnly = searchParams.get('warnings') === '1'

  const load = useCallback(() => {
    setIsLoading(true)
    try {
      setIndex(getLeaderboardIndex())
    } catch {
      setIndex(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const teams = useMemo(() => {
    if (!index) return []
    const filtered = index.teams.filter((team) => {
      const matchesStatus = statusFilter === 'all' || team.status === statusFilter
      const matchesWarnings = !warningsOnly || (team.warnings?.length ?? 0) > 0
      return matchesStatus && matchesWarnings
    })
    return sortTeams(filtered, sortKey, direction)
  }, [direction, index, sortKey, statusFilter, warningsOnly])

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      updateParams({ dir: direction === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: key, dir: key === 'rank' ? 'asc' : 'desc' })
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-6xl p-6" aria-busy="true">
        Загрузка рейтинга…
      </main>
    )
  }

  if (!index) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Рейтинг команд</h1>
        <p role="alert" className="text-destructive">
          Не удалось загрузить дата-бандл.
        </p>
        <Button type="button" variant="outline" onClick={load}>
          Повторить
        </Button>
      </main>
    )
  }

  const builtAt = index.meta?.built_at ?? index.built_at

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Внутренний обзор качества</p>
        <h1 className="text-3xl font-semibold tracking-tight">Рейтинг команд</h1>
        <p className="text-sm text-muted-foreground">
          Бандл собран {new Date(builtAt).toLocaleString('ru-RU')}
        </p>
      </header>

      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Оценка — вспомогательная метрика для ревью. Итоговое решение принимает жюри вне системы.
      </p>

      <section aria-label="Фильтры рейтинга" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Статус</span>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(event) =>
              updateParams({ status: event.target.value === 'all' ? null : event.target.value })
            }
          >
            <option value="all">Все команды</option>
            <option value="done">Готово</option>
            <option value="failed">Ошибка</option>
            <option value="no_data">Нет данных</option>
            <option value="running">Выполняется</option>
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={warningsOnly}
            onChange={(event) => updateParams({ warnings: event.target.checked ? '1' : null })}
          />
          Только с предупреждениями
        </label>
        <span className="text-sm text-muted-foreground">
          Показано: {teams.length} из {index.teams.length}
        </span>
      </section>

      {teams.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-muted-foreground">
          По выбранным фильтрам команд нет.
        </p>
      ) : (
        <LeaderboardTable teams={teams} sortKey={sortKey} direction={direction} onSort={onSort} />
      )}
    </main>
  )
}
