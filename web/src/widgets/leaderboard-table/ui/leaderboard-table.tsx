import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TeamStatusBadge, TeamWarningBadges } from '@/entities/team'
import type { SortDirection, SortKey } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'
import { ScoreGauge } from '@/shared/ui'

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
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ChevronsUpDown aria-hidden="true" size={12} strokeWidth={2.2} />
  return direction === 'asc' ? (
    <ChevronUp aria-hidden="true" size={12} strokeWidth={2.2} />
  ) : (
    <ChevronDown aria-hidden="true" size={12} strokeWidth={2.2} />
  )
}

export function LeaderboardTable({ teams, sort, onSort }: LeaderboardTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-card border border-line xl:block">
      <table className="w-full min-w-[1100px] table-fixed border-collapse">
        <caption className="sr-only">
          Рейтинг команд по автоматической оценке качества кода. Сортировка:{' '}
          {SORT_COLUMNS.find((column) => column.key === sort.key)?.label},{' '}
          {sort.direction === 'asc' ? 'по возрастанию' : 'по убыванию'}.
        </caption>
        <colgroup>
          <col style={{ width: 62 }} />
          <col />
          <col style={{ width: 152 }} />
          <col style={{ width: 152 }} />
          <col style={{ width: 132 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 250 }} />
        </colgroup>
        <thead>
          <tr className="bg-muted-surface">
            <th
              scope="col"
              aria-sort={
                sort.key === 'rank'
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
              className="text-overline px-4 py-2.5 text-left text-fg-muted uppercase"
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
            <th scope="col" className="text-overline px-4 py-2.5 text-left text-fg-muted uppercase">
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
                className={`text-overline px-4 py-2.5 uppercase ${align === 'right' ? 'text-right' : 'text-left'} ${sort.key === key ? 'text-fg' : 'text-fg-muted'}`}
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
            <th scope="col" className="text-overline px-4 py-2.5 text-left text-fg-muted uppercase">
              Статус
            </th>
            <th scope="col" className="text-overline px-4 py-2.5 text-left text-fg-muted uppercase">
              Признаки
            </th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => {
            const tied = team.rank != null && team.rank === teams[index - 1]?.rank
            return (
              <tr key={team.team_id} className="border-t border-line">
                <td className="px-4 py-2.5 text-[15px] text-fg-muted">
                  {team.rank ?? <span className="text-fg-subtle">—</span>}
                  {tied ? <span className="ml-1 text-[12.5px] text-fg-subtle">=</span> : null}
                </td>
                <td className="px-4 py-2.5">
                  {team.status === 'done' || team.status === 'running' ? (
                    <Link
                      to={`/team/${team.team_id}`}
                      className="inline-flex min-h-10 items-center text-strong no-underline"
                    >
                      {team.name}
                    </Link>
                  ) : (
                    <span className="text-strong">{team.name}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <ScoreGauge
                      value={team.total}
                      size="inline"
                      trackWidth={58}
                      showMax={false}
                      showWord={false}
                      partial={team.partial}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <ScoreGauge
                      value={team.areas?.backend ?? null}
                      size="micro"
                      trackWidth={58}
                      showMax={false}
                      showWord={false}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <ScoreGauge
                      value={team.areas?.frontend ?? null}
                      size="micro"
                      trackWidth={58}
                      showMax={false}
                      showWord={false}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <TeamStatusBadge status={team.status} partial={team.partial} />
                    {team.status === 'running' || team.status === 'done' ? (
                      <Link
                        className="inline-flex min-h-9 items-center text-sm text-link"
                        to={`/team/${team.team_id}`}
                      >
                        {team.status === 'running' ? 'Смотреть ход оценки' : 'Открыть отчёт'}
                      </Link>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <TeamWarningBadges warnings={team.warnings} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
