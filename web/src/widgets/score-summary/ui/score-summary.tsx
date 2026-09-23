import type { TeamArea, TeamBundle } from '@/shared/api'
import { ScoreGauge } from '@/shared/ui'

/**
 * Итог + карточка на каждую присутствующую область — `design/reference/screens/04-team-light.html`.
 * Область со статусом, отличным от `done` (`no_data`/`failed`/`running`), показывает прочерк, а
 * не 0 (принцип VI, тот же приём, что FR-006 в 005).
 */

export interface ScoreSummaryProps {
  team: TeamBundle
}

function areaScore(area: TeamArea): number | null {
  return area.status === 'done' ? area.score : null
}

export function ScoreSummary({ team }: ScoreSummaryProps) {
  const areas = Object.entries(team.areas) as [string, TeamArea][]

  return (
    <section aria-label="Итоговый балл" className="flex flex-wrap items-stretch gap-4">
      <div className="flex w-full flex-col gap-3 rounded-card border border-line bg-surface px-6 py-5 sm:w-[340px] sm:shrink-0">
        <div className="text-overline text-fg-muted uppercase">Оценка инструмента, итог</div>
        <ScoreGauge value={team.total} size="hero" layout="stacked" partial={team.partial} />
        <div className="mt-0.5 border-t border-line pt-3 text-[14.5px] leading-[1.5] text-fg-subtle">
          Значение одной автоматической проверки кода, не результат команды на хакатоне.
        </div>
      </div>

      {areas.map(([areaName, area]) => (
        <div
          key={areaName}
          className="flex min-w-[240px] flex-grow flex-col gap-3 rounded-card border border-line bg-surface px-6 py-5"
        >
          <div className="text-overline text-fg-muted capitalize">{areaName}</div>
          <ScoreGauge value={areaScore(area)} size="hero" layout="stacked" />
        </div>
      ))}
    </section>
  )
}
