import { Link } from 'react-router-dom'

import { displayRank, TeamStatusBadge, TeamWarningBadges } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'
import { formatScore } from '@/shared/lib'

/**
 * Карточка рейтинга на узком экране (< 768px) — `design/reference/screens/03-leaderboard-
 * mobile.html`. FR-015 / edge case из spec.md: место, название и итог остаются в одной строке,
 * backend и frontend уходят во вторую.
 */

export interface LeaderboardRowCardProps {
  team: LeaderboardTeam
  onSelectTeam?: () => void
}

export function LeaderboardRowCard({ team, onSelectTeam }: LeaderboardRowCardProps) {
  const hasBadges = team.status !== 'done' || team.partial || (team.warnings?.length ?? 0) > 0

  const content = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-[15px] text-fg-muted">
          {displayRank(team) ?? <span className="text-fg-subtle">—</span>}
        </span>
        <span className="min-w-0 flex-grow overflow-wrap-anywhere text-[17px] font-medium text-fg">
          {team.name}
        </span>
        <span className="text-[18px] font-medium tabular-nums text-fg">
          {formatScore(team.total)}
        </span>
      </div>
      <div className="flex items-center gap-3.5 text-[13.5px] text-fg-muted">
        <span className="flex items-center gap-1.5">
          backend
          <strong className="font-medium text-fg">{formatScore(team.areas?.backend)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          frontend
          <strong className="font-medium text-fg">{formatScore(team.areas?.frontend)}</strong>
        </span>
      </div>
      {hasBadges ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {team.status !== 'done' || team.partial ? (
            <TeamStatusBadge status={team.status} partial={team.partial} />
          ) : null}
          <TeamWarningBadges warnings={team.warnings} />
        </div>
      ) : team.status === 'failed' && onSelectTeam ? (
        <button
          type="button"
          className="inline-flex min-h-10 items-center text-sm text-link"
          onClick={(event) => {
            event.currentTarget.focus()
            onSelectTeam()
          }}
        >
          Подробнее
        </button>
      ) : null}
    </>
  )
  const className =
    'flex flex-col gap-2 rounded-card border border-line bg-surface px-[13px] py-2.5 no-underline'
  return (
    <article className={`${className} ${onSelectTeam ? 'transition-colors' : ''}`}>
      {onSelectTeam ? (
        <button
          type="button"
          aria-label={`Быстрый просмотр ${team.name}`}
          className="w-full cursor-pointer rounded-control border-0 bg-transparent p-0 text-left hover:bg-muted-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={(event) => {
            event.currentTarget.focus()
            onSelectTeam()
          }}
        >
          {content}
        </button>
      ) : (
        content
      )}
      {team.status === 'running' || team.status === 'done' ? (
        <Link
          className="inline-flex min-h-10 items-center text-sm text-link"
          to={`/team/${team.team_id}`}
        >
          {team.status === 'running' ? 'Смотреть ход оценки' : 'Открыть отчёт'}
        </Link>
      ) : null}
    </article>
  )
}
