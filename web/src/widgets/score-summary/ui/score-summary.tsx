import type { TeamArea, TeamBundle } from '@/shared/api'
import { ScoreGauge, ScoreRing } from '@/shared/ui'

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
    <section
      aria-label="Итоговый балл"
      className="dashboard-score-summary flex flex-wrap items-stretch"
    >
      <div className="dashboard-panel dashboard-score-summary-hero flex w-full flex-col gap-3 px-6 py-5 sm:w-[340px] sm:shrink-0">
        <div className="text-overline text-fg-muted uppercase">Оценка инструмента, итог</div>
        <ScoreRing value={team.total} label="Итоговая оценка" />
        <div className="mt-0.5 border-t border-line pt-3 text-[14.5px] leading-[1.5] text-fg-subtle">
          Значение одной автоматической проверки кода, не результат команды на хакатоне.
        </div>
      </div>

      {areas.map(([areaName, area]) => (
        <div
          key={areaName}
          className="dashboard-panel flex min-w-[240px] flex-grow flex-col gap-3 px-6 py-5"
        >
          <div className="text-overline text-fg-muted capitalize">{areaName}</div>
          <ScoreGauge value={areaScore(area)} size="hero" layout="stacked" />
        </div>
      ))}
    </section>
  )
}
