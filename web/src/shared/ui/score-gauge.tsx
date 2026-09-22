import { cn } from 'cn'

import { SCORE_MAX, formatScore, scoreFillPercent, scoreLevel, scoreWord } from '@/shared/lib'

/**
 * ScoreGauge — число, дорожка и слово одним элементом.
 * Разметка и значения: design/reference/tokens.json → scoreScale, size.gauge.
 *
 * Почему не shadcn Progress: у него нет состояния «значения нет» и нет текстовой части,
 * а по правилам дизайна цвет не может быть единственным носителем смысла
 * (design/reference/DESIGN.md → «Шкала баллов 0–10»).
 *
 * Балл `null` рисуется прочерком и пустой пунктирной дорожкой. Ноль не рисуется никогда:
 * он означал бы плохой код, а кода нет.
 */

type GaugeSize = 'hero' | 'row' | 'inline' | 'micro'

const TRACK_HEIGHT: Record<GaugeSize, string> = {
  hero: 'var(--ds-gauge-hero)',
  row: 'var(--ds-gauge-row)',
  inline: 'var(--ds-gauge-inline)',
  micro: 'var(--ds-gauge-micro)',
}

const NUMBER_CLASS: Record<GaugeSize, string> = {
  hero: 'text-score-hero leading-none',
  row: 'text-[22px] font-light leading-none tracking-[-0.02em]',
  inline: 'text-[15px] font-medium tracking-[-0.01em]',
  micro: 'text-[14px] tracking-[-0.01em]',
}

const LEVEL_COLOR = [
  'var(--ds-score-1)',
  'var(--ds-score-2)',
  'var(--ds-score-3)',
  'var(--ds-score-4)',
  'var(--ds-score-5)',
] as const

export interface ScoreGaugeProps {
  /** Балл 0–10 или `null`, если оценки нет. */
  value: number | null
  size?: GaugeSize
  /** Ширина дорожки в пикселях — берётся из макета конкретного экрана. */
  trackWidth?: number
  /** Показывать словесную ступень. Скрытая остаётся доступной скринридеру. */
  showWord?: boolean
  /** Показывать «/ 10» рядом с числом. */
  showMax?: boolean
  /** Частичная оценка: незанятая часть дорожки заштрихована, а не залита. */
  partial?: boolean
  className?: string
}

export function ScoreGauge({
  value,
  size = 'row',
  trackWidth = 96,
  showWord = true,
  showMax = true,
  partial = false,
  className,
}: ScoreGaugeProps) {
  const height = TRACK_HEIGHT[size]
  const radius = `calc(${height} / 2)`

  if (value === null) {
    return (
      <span className={cn('inline-flex items-center gap-2.5', className)}>
        <span className={cn(NUMBER_CLASS[size], 'text-fg-subtle')}>—</span>
        <span
          aria-hidden="true"
          className="block box-border border border-dashed border-line-strong"
          style={{ width: trackWidth, height, borderRadius: radius }}
        />
        <span className="sr-only">оценки нет</span>
      </span>
    )
  }

  const level = scoreLevel(value)
  const word = scoreWord(value)

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex items-baseline gap-1.5">
        <span className={NUMBER_CLASS[size]}>{formatScore(value)}</span>
        {showMax ? (
          <span className="text-[12px] text-fg-subtle">/ {SCORE_MAX}</span>
        ) : (
          <span className="sr-only">из {SCORE_MAX}</span>
        )}
      </span>

      <span
        aria-hidden="true"
        className="block overflow-hidden"
        style={{
          width: trackWidth,
          height,
          borderRadius: radius,
          background: partial ? 'var(--ds-track-partial)' : 'var(--ds-track)',
        }}
      >
        <span
          className="block"
          style={{
            width: `${scoreFillPercent(value)}%`,
            height,
            borderRadius: radius,
            background: LEVEL_COLOR[level - 1],
          }}
        />
      </span>

      {showWord ? (
        <span className="text-meta text-fg-muted">{word}</span>
      ) : (
        <span className="sr-only">{word}</span>
      )}
    </span>
  )
}
