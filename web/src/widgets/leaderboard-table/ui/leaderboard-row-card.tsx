import { Link } from 'react-router-dom'

import { TeamStatusBadge, TeamWarningBadges } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'
import { ScoreGauge } from '@/shared/ui'

/**
 * Карточка рейтинга на узком экране (< 768px) — `design/reference/screens/03-leaderboard-
 * mobile.html`. FR-015 / edge case из spec.md: место, название и итог остаются в одной строке,
 * backend и frontend уходят во вторую.
 */

export interface LeaderboardRowCardProps {
  team: LeaderboardTeam
}

export function LeaderboardRowCard({ team }: LeaderboardRowCardProps) {
  const hasBadges = team.status !== 'done' || team.partial || (team.warnings?.length ?? 0) > 0

  const content = (
    <>
      <div className="flex items-center gap-2.5">
        <span className="w-5 shrink-0 text-[15px] text-fg-muted">
          {team.rank ?? <span className="text-fg-subtle">—</span>}
        </span>
        <span className="flex-grow text-[17px] font-medium text-fg">{team.name}</span>
        <ScoreGauge
          value={team.total}
          size="row"
          trackWidth={72}
          showWord={false}
          partial={team.partial}
        />
      </div>
      <div className="flex items-center gap-3.5 text-[13.5px] text-fg-muted">
        <span className="flex items-center gap-1.5">
          backend
          <ScoreGauge
            value={team.areas?.backend ?? null}
            size="micro"
            trackWidth={34}
            showMax={false}
            showWord={false}
          />
        </span>
        <span className="flex items-center gap-1.5">
          frontend
          <ScoreGauge
            value={team.areas?.frontend ?? null}
            size="micro"
            trackWidth={34}
            showMax={false}
            showWord={false}
          />
        </span>
      </div>
      {hasBadges ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {team.status !== 'done' || team.partial ? (
            <TeamStatusBadge status={team.status} partial={team.partial} />
          ) : null}
          <TeamWarningBadges warnings={team.warnings} />
        </div>
      ) : null}
    </>
  )
  const className =
    'flex flex-col gap-[9px] rounded-card border border-line bg-surface px-[13px] py-3 no-underline'
  return team.status === 'done' || team.status === 'running' ? (
    <Link to={`/team/${team.team_id}`} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  )
}
