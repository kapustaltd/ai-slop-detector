import { ArrowUp, Ruler } from 'lucide-react'

import { anchorPlacement, type AnchorLevel } from '../model/contribution'

/**
 * Якоря 2/5/8/10 с отметкой фактического балла между ними — `design/reference/screens/06-metric-
 * drilldown.html`. Строка «инструмент поставил N» вставляется между карточками соседних якорей по
 * значению балла (DESIGN.md), а не движется по непрерывной дорожке.
 */

export interface AnchorScaleProps {
  anchors: { '2': string; '5': string; '8': string; '10': string }
  score: number
  rubricLabel: string // «рубрика backend v1.4»
  className?: string
}

const LEVELS: AnchorLevel[] = [2, 5, 8, 10]

export function AnchorScale({ anchors, score, rubricLabel, className }: AnchorScaleProps) {
  const placement = anchorPlacement(score)

  return (
    <div
      className={`flex flex-col gap-2.5 rounded-card border border-line bg-muted-surface px-[18px] py-4 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2">
        <Ruler aria-hidden="true" size={14} strokeWidth={2} className="text-fg-muted" />
        <span className="text-[15px] font-medium">Как это оценивается</span>
        <span className="text-[13.5px] text-fg-subtle">
          якоря шкалы для этой метрики · {rubricLabel}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {LEVELS.map((level) => {
          const isClosest = placement.closerTo === level
          return (
            <div key={level}>
              <div
                className={`flex items-start gap-3.5 rounded-control border bg-surface px-3 py-2.5 ${
                  isClosest ? 'border-line-strong' : 'border-line'
                }`}
              >
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-control bg-track text-[15px] font-medium tabular-nums">
                  {level}
                </span>
                <span
                  className={`text-[14.5px] leading-[1.6] ${isClosest ? 'text-fg' : 'text-fg-muted'}`}
                >
                  {anchors[String(level) as '2' | '5' | '8' | '10']}
                </span>
              </div>
              {!placement.exact && placement.lower === level ? (
                <div className="flex items-center gap-2.5 px-3 py-[3px]">
                  <span className="flex items-center gap-1.5 rounded-control bg-fg px-2.5 py-[3px] text-[13.5px] font-medium text-on-accent">
                    <ArrowUp aria-hidden="true" size={12} strokeWidth={2.4} />
                    инструмент поставил {score.toFixed(1)}
                  </span>
                  <span aria-hidden="true" className="h-px flex-grow bg-line-strong" />
                  <span className="text-[13.5px] text-fg-muted">
                    между якорями {placement.lower} и {placement.upper}, ближе к{' '}
                    {placement.closerTo}
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
