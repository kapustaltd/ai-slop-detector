import { ChevronLeft, ChevronRight, CircleDashed } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TeamStatusBadge } from '@/entities/team'
import type { TeamBundle } from '@/shared/api'

import { countLowConfidenceMetrics } from '../model/low-confidence-count'
import type { TeamRankContext } from '../model/rank-context'

/**
 * Хлебные крошки, заголовок, статус, место в рейтинге, prev/next — `design/reference/screens/04-
 * team-light.html`. Ссылка на репозиторий/ветка из макета не выводится: `TeamBundle` их не несёт
 * (research.md → «SHA без ссылки на коммит», Q15 в docs/open-questions.md); SHA — в
 * `EvaluationMeta`, не здесь.
 */

export interface TeamHeaderProps {
  team: TeamBundle
  rankContext: TeamRankContext
}

export function TeamHeader({ team, rankContext }: TeamHeaderProps) {
  const lowConfidenceCount = countLowConfidenceMetrics(team)
  const areaEntries = Object.entries(team.areas)
  const areasSummary =
    areaEntries.length > 1
      ? areaEntries.every(([, area]) => area.status === 'done')
        ? 'обе области оценены'
        : `оценена ${areaEntries.filter(([, area]) => area.status === 'done').length} из ${areaEntries.length} областей`
      : null

  return (
    <header className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
        <nav
          aria-label="Хлебные крошки"
          className="flex items-center gap-2 text-[14.5px] text-fg-muted"
        >
          <Link to="/" className="inline-flex min-h-11 items-center no-underline md:min-h-10">
            Рейтинг
          </Link>
          <span className="text-fg-subtle">/</span>
          <span className="text-fg">{team.name}</span>
        </nav>
        {rankContext.previousTeamId || rankContext.nextTeamId ? (
          <div className="flex items-center gap-2.5">
            {rankContext.previousTeamId ? (
              <Link
                to={`/team/${rankContext.previousTeamId}`}
                className="flex min-h-11 items-center gap-1.5 rounded-control border border-line-strong px-2.5 text-[14.5px] text-fg no-underline md:min-h-10"
              >
                <ChevronLeft aria-hidden="true" size={13} strokeWidth={2.2} />
                Предыдущая команда
              </Link>
            ) : null}
            {rankContext.nextTeamId ? (
              <Link
                to={`/team/${rankContext.nextTeamId}`}
                className="flex min-h-11 items-center gap-1.5 rounded-control border border-line-strong px-2.5 text-[14.5px] text-fg no-underline md:min-h-10"
              >
                Следующая команда
                <ChevronRight aria-hidden="true" size={13} strokeWidth={2.2} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-[7px]">
          <div className="flex items-center gap-3">
            <h1 className="text-h1 m-0">{team.name}</h1>
            <TeamStatusBadge status={team.status} partial={team.partial} />
            {lowConfidenceCount > 0 ? (
              <span className="inline-flex h-6 items-center gap-[5px] rounded-control border border-dashed border-line-strong bg-muted-surface px-2.5 text-[13.5px] font-medium text-fg-muted">
                <CircleDashed aria-hidden="true" size={12} strokeWidth={2.1} />
                Низкая уверенность: {lowConfidenceCount}{' '}
                {lowConfidenceCount === 1 ? 'метрика' : 'метрики'}
              </span>
            ) : null}
          </div>
          {areasSummary ? <div className="text-[14.5px] text-fg-muted">{areasSummary}</div> : null}
        </div>

        {rankContext.rank != null ? (
          <span className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-[14.5px] text-fg-muted">
            Место в рейтинге{' '}
            <span className="font-medium text-fg">
              {rankContext.rank} из {rankContext.totalTeams}
            </span>{' '}
            {rankContext.tiedWith.length > 0 ? (
              <span className="text-fg-subtle">
                (также «{rankContext.tiedWith[0]}»
                {rankContext.tiedWith.length > 1 ? ` и ещё ${rankContext.tiedWith.length - 1}` : ''}
                )
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </header>
  )
}
