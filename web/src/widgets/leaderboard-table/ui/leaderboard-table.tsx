import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'

import { displayRank, TeamStatusBadge, TeamWarningBadges } from '@/entities/team'
import type { SortDirection, SortKey } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'
import { formatScore } from '@/shared/lib'

import { SORT_COLUMNS } from '../model/columns'

/**
 * Десктопная таблица рейтинга. Композиция и значения — `design/reference/screens/01-leaderboard-
 * light.html`. Порядок строк уже готов (сортировка/фильтрация — в `useLeaderboardState`), эта
 * таблица только рисует.
 */

export interface LeaderboardTableProps {
  teams: LeaderboardTeam[]
  sort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
  onSelectTeam?: (team: LeaderboardTeam) => void
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown aria-hidden="true" size={12} strokeWidth={2.2} />
  return direction === 'asc' ? (
    <ChevronUp aria-hidden="true" size={12} strokeWidth={2.2} />
  ) : (
    <ChevronDown aria-hidden="true" size={12} strokeWidth={2.2} />
  )
}

export function LeaderboardTable({ teams, sort, onSort, onSelectTeam }: LeaderboardTableProps) {
  return (
    <div className="leaderboard-table-shell hidden overflow-x-auto xl:block">
      <table className="leaderboard-table w-full min-w-[980px] table-auto border-collapse">
        <caption className="sr-only">
          Рейтинг команд по автоматической оценке качества кода. Сортировка:{' '}
          {SORT_COLUMNS.find((column) => column.key === sort.key)?.label},{' '}
          {sort.direction === 'asc' ? 'по возрастанию' : 'по убыванию'}.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              aria-sort={
                sort.key === 'rank'
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
              className="leaderboard-table-label text-overline px-4 py-2.5 text-left uppercase"
            >
              <button
                type="button"
                aria-label="Сортировать по месту"
                onClick={() => onSort('rank')}
                className="inline-flex min-h-10 items-center gap-1"
              >
                № <SortIcon active={sort.key === 'rank'} direction={sort.direction} />
              </button>
            </th>
            <th
              scope="col"
              className="leaderboard-table-label text-overline px-4 py-2.5 text-left uppercase"
            >
              Команда
            </th>
            {SORT_COLUMNS.filter(({ key }) => key !== 'rank').map(({ key, label, align }) => (
              <th
                key={key}
                scope="col"
                aria-sort={
                  sort.key === key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className={`leaderboard-table-label text-overline px-4 py-2.5 uppercase ${align === 'right' ? 'text-right' : 'text-left'} ${sort.key === key ? 'is-active' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onSort(key)}
                  className={`inline-flex min-h-10 items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}
                >
                  {label}
                  <SortIcon active={sort.key === key} direction={sort.direction} />
                </button>
              </th>
            ))}
            <th
              scope="col"
              className="leaderboard-table-label text-overline px-4 py-2.5 text-left uppercase"
            >
              Статус
            </th>
            <th
              scope="col"
              className="leaderboard-table-label leaderboard-table-signals text-overline px-4 py-2.5 text-left uppercase"
            >
              Ограничения
            </th>
            <th
              scope="col"
              className="leaderboard-table-label leaderboard-table-report text-overline px-4 py-2.5 text-left uppercase"
            >
              Отчёт
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => {
            const rank = displayRank(team)
            const previousRank = teams[index - 1] ? displayRank(teams[index - 1]) : null
            const tied = rank != null && rank === previousRank
            return (
              <tr
                key={team.team_id}
                className={` ${onSelectTeam ? 'cursor-pointer hover:bg-muted-surface' : ''}`}
                onClick={(event) => {
                  if (
                    onSelectTeam &&
                    !(event.target instanceof Element && event.target.closest('a,button'))
                  ) {
                    event.currentTarget.querySelector<HTMLElement>('a[href], button')?.focus()
                    onSelectTeam(team)
                  }
                }}
              >
                <td className="px-4 py-2 text-[15px] text-fg-muted">
                  {rank ?? <span className="text-fg-subtle">—</span>}
                  {tied ? <span className="ml-1 text-[12.5px] text-fg-subtle">=</span> : null}
                </td>
                <td className="px-4 py-2">
                  {team.status === 'done' || team.status === 'running' ? (
                    <Link
                      to={`/team/${team.team_id}`}
                      className="inline-flex min-h-10 items-center text-strong no-underline"
                      onClick={(event) => {
                        if (onSelectTeam) {
                          event.preventDefault()
                          event.currentTarget.focus()
                          onSelectTeam(team)
                        }
                      }}
                    >
                      <span className="overflow-wrap-anywhere">{team.name}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex min-h-10 max-w-full items-center text-left text-strong underline-offset-2 hover:text-link hover:underline"
                      onClick={(event) => {
                        event.currentTarget.focus()
                        onSelectTeam?.(team)
                      }}
                    >
                      {team.name}
                    </button>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="table-score table-score-total">{formatScore(team.total)}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="table-score">{formatScore(team.areas?.backend)}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="table-score">{formatScore(team.areas?.frontend)}</span>
                </td>
                <td className="px-4 py-2 align-middle">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TeamStatusBadge status={team.status} partial={team.partial} />
                  </div>
                </td>
                <td className="leaderboard-table-signals px-4 py-2">
                  <TeamWarningBadges warnings={team.warnings} compact />
                </td>
                <td className="leaderboard-table-report px-4 py-2 whitespace-nowrap">
                  {team.status === 'running' || team.status === 'done' ? (
                    <Link
                      className="inline-flex min-h-8 items-center text-[13px] text-link"
                      to={`/team/${team.team_id}`}
                    >
                      {team.status === 'running' ? 'Смотреть ход оценки' : 'Открыть отчёт'}
                    </Link>
                  ) : team.status === 'failed' ? (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center text-[13px] text-link"
                      onClick={(event) => {
                        event.stopPropagation()
                        event.currentTarget.focus()
                        onSelectTeam?.(team)
                      }}
                    >
                      Подробнее
                    </button>
                  ) : (
                    <span className="text-fg-faint">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
