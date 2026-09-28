import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TeamStatusBadge } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'
import { formatScore } from '@/shared/lib'

interface LeaderboardFocusPanelProps {
  team: LeaderboardTeam
}

export function LeaderboardFocusPanel({ team }: LeaderboardFocusPanelProps) {
  const areas = [
    ['backend', team.areas.backend ?? null],
    ['frontend', team.areas.frontend ?? null],
  ] as const

  return (
    <section className="dashboard-panel dashboard-focus-panel" aria-label="Текущий лидер">
      <div className="dashboard-focus-content">
        <div className="dashboard-focus-leading">
          <span className="dashboard-rank-label">
            {team.rank == null ? '—' : `#${String(team.rank).padStart(2, '0')}`}
          </span>
          <Link
            aria-label={`Открыть отчёт команды ${team.name}`}
            id="leaderboard-focus-team-name"
            className="dashboard-team-name"
            to={`/team/${team.team_id}`}
          >
            {team.name}
            <ArrowUpRight aria-hidden="true" size={16} strokeWidth={2} />
          </Link>
        </div>
        <div
          className="dashboard-focus-score"
          aria-label={`Итоговая оценка: ${formatScore(team.total)} из 10`}
        >
          <span className="dashboard-focus-score-value">{formatScore(team.total)}</span>
          <span className="dashboard-focus-score-max">/ 10</span>
        </div>
        <div className="dashboard-focus-areas">
          {areas.map(([name, value]) => (
            <div key={name} className="dashboard-focus-area">
              <span className="dashboard-focus-area-label">
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </span>
              <strong>{formatScore(value)}</strong>
            </div>
          ))}
        </div>
        <div className="dashboard-focus-actions">
          <TeamStatusBadge status={team.status} partial={team.partial} />
          {team.status === 'running' || team.status === 'done' ? (
            <Link className="text-link" to={`/team/${team.team_id}`}>
              {team.status === 'running' ? 'Смотреть ход оценки' : 'Открыть отчёт'}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}
