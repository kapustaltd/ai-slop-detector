import { ArrowRight, Info } from 'lucide-react'

import type { TeamArea, TeamBundle } from '@/shared/api'
import { formatScore, scoreWord } from '@/shared/lib'
import { SectionLink } from '@/shared/ui'

import { describeAreaStatus } from '../model/area-status'

/**
 * Компактная сводка автоматической оценки. Область со статусом, отличным от `done`
 * (`no_data`/`failed`/`running`) показывает причину, а не пустую шкалу прогресса.
 */

export interface ScoreSummaryProps {
  team: TeamBundle
}

function areaScore(area: TeamArea): number | null {
  return area.status === 'done' ? area.score : null
}

function areaLabel(areaName: string): string {
  return areaName.charAt(0).toUpperCase() + areaName.slice(1)
}

function areaCountWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'область'
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'области'
  }
  return 'областей'
}

function areaCountAfterFrom(count: number): string {
  return count === 1 ? 'области' : 'областей'
}

function lowConfidenceMetrics(team: TeamBundle) {
  return Object.entries(team.areas).flatMap(([areaName, area]) =>
    area.categories.flatMap((category) =>
      category.subcategories.flatMap((subcategory) =>
        subcategory.metrics
          .filter((metric) => metric.confidence === 'low')
          .map((metric) => ({ areaName, categoryName: category.name, metric })),
      ),
    ),
  )
}

export function ScoreSummary({ team }: ScoreSummaryProps) {
  const areas = Object.entries(team.areas) as [string, TeamArea][]
  const evaluatedAreas = areas.filter(([, area]) => area.status === 'done')
  const isPreliminary = team.partial || evaluatedAreas.length < areas.length
  const confidenceLimits = lowConfidenceMetrics(team)
  const coverageLabel =
    evaluatedAreas.length === areas.length
      ? areas.length === 2
        ? 'Оценены обе области'
        : `Оценены все ${areas.length} ${areaCountWord(areas.length)}`
      : `${evaluatedAreas.length === 1 ? 'Оценена' : 'Оценено'} ${evaluatedAreas.length} из ${areas.length} ${areaCountAfterFrom(areas.length)}`

  return (
    <section
      aria-label="Сводка автоматической оценки"
      className="dashboard-score-summary dashboard-reveal"
    >
      <div className="dashboard-panel dashboard-score-summary-total">
        <div className="dashboard-score-summary-lead">
          <div className="text-overline text-fg-muted">
            {isPreliminary ? 'Предварительная оценка' : 'Итоговая оценка'}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="dashboard-score-summary-value" aria-label="Оценка команды">
              {formatScore(team.total)}
            </span>
            <span className="text-[15px] text-fg-subtle">/ 10</span>
          </div>
          <p className="dashboard-score-summary-coverage">{coverageLabel}</p>
        </div>

        <ul className="dashboard-score-summary-areas" aria-label="Оценка по областям">
          {areas.map(([areaName, area]) => {
            const status = describeAreaStatus(areaName, area)
            const score = areaScore(area)
            return (
              <li key={areaName} className="dashboard-score-summary-area">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[15px] font-medium">{areaLabel(areaName)}</span>
                    {score != null ? (
                      <span className="text-[22px] font-medium tracking-[-0.03em] tabular-nums">
                        {formatScore(score)}{' '}
                        <span className="text-[14px] font-normal text-fg-subtle">/ 10</span>
                      </span>
                    ) : (
                      <span className="text-[15px] font-medium text-fg-muted">Не оценён</span>
                    )}
                  </div>
                  {score != null ? (
                    <SectionLink
                      target={`area-${areaName}`}
                      className="inline-flex min-h-9 items-center gap-1 text-[14px] font-medium text-link underline-offset-4 hover:underline"
                    >
                      Открыть разбор
                      <ArrowRight aria-hidden="true" size={14} />
                    </SectionLink>
                  ) : null}
                </div>
                <div className="mt-1.5 text-[13.5px] leading-5 text-fg-muted">
                  {score != null
                    ? `Уровень по шкале: ${scoreWord(score)}`
                    : `Причина: ${status.detail}`}
                </div>
              </li>
            )
          })}
        </ul>

        {confidenceLimits.length > 0 ? (
          <details className="dashboard-score-summary-constraint">
            <summary>
              <Info aria-hidden="true" size={15} strokeWidth={2} />
              Ограниченная уверенность по {confidenceLimits.length}{' '}
              {confidenceLimits.length === 1 ? 'критерию' : 'критериям'}
            </summary>
            <div className="mt-3 grid gap-3">
              {confidenceLimits.map(({ areaName, categoryName, metric }) => (
                <div
                  key={`${areaName}-${metric.id}`}
                  className="grid gap-1 text-[13.5px] leading-5"
                >
                  <div className="font-medium text-fg">
                    {areaLabel(areaName)} · {categoryName} · {metric.name}
                  </div>
                  <div className="text-fg-muted">Причина: {metric.rationale}</div>
                  <div className="text-fg-muted">
                    Влияние: критерий учтён в балле, но вывод по нему стоит проверить вручную.
                  </div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <p className="dashboard-score-summary-note">
        Автоматическая оценка качества кода, а не результат команды на хакатоне.
      </p>
    </section>
  )
}
