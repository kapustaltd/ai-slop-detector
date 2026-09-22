import { cn } from 'cn'

import { SCORE_MAX, formatScore, scoreFillPercent, scoreLevel, scoreWord } from '@/shared/lib'

/**
 * ScoreGauge — число, дорожка и слово одним элементом; принимает значение или `null`.
 * Разметка и значения: design/reference/tokens.json → scoreScale, size.gauge.
 *
 * Почему не shadcn Progress: у него нет состояния «значения нет» и нет текстовой части,
 * а по правилам дизайна цвет не может быть единственным носителем смысла
 * (design/reference/DESIGN.md → «Шкала баллов 0–10»).
 *
 * Балл `null` рисуется прочерком и пустой пунктирной дорожкой. Ноль не рисуется никогда:
 * он означал бы плохой код, а кода нет.
 *
 * `layout: 'stacked'` (006): число+максимум в одной строке, дорожка на всю ширину ниже, слово
 * под ней — для карточек-героев, где дорожка должна занимать всю ширину контейнера, а не
 * фиксированный `trackWidth` в общей строке с числом (макет `04-team-light.html`, «Оценка
 * инструмента, итог»). `layout: 'inline'` (по умолчанию) — прежнее поведение, число/дорожка/слово
 * в одной строке.
 */

type GaugeSize = 'hero' | 'row' | 'inline' | 'micro'
type GaugeLayout = 'inline' | 'stacked'

const TRACK_HEIGHT: Record<GaugeSize, string> = {
  hero: 'var(--ds-gauge-hero)',
  row: 'var(--ds-gauge-row)',
  inline: 'var(--ds-gauge-inline)',
  micro: 'var(--ds-gauge-micro)',
}

const NUMBER_CLASS: Record<GaugeSize, string> = {
  hero: 'text-score-hero leading-none',
  row: 'text-[22px] font-light leading-none tracking-[-0.02em]',
  inline: 'text-[17px] font-medium tracking-[-0.01em]',
  micro: 'text-[16px] tracking-[-0.01em]',
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
  /** Ширина дорожки в пикселях — берётся из макета конкретного экрана. Игнорируется при `layout: 'stacked'` (дорожка на всю ширину). */
  trackWidth?: number
  /** Показывать словесную ступень. Скрытая остаётся доступной скринридеру. */
  showWord?: boolean
  /** Показывать «/ 10» рядом с числом. */
  showMax?: boolean
  /** Частичная оценка: незанятая часть дорожки заштрихована, а не залита. */
  partial?: boolean
  /** `inline` (по умолчанию) — число/дорожка/слово в строке. `stacked` — дорожка на всю ширину под числом. */
  layout?: GaugeLayout
  className?: string
}

export function ScoreGauge({
  value,
  size = 'row',
  trackWidth = 96,
  showWord = true,
  showMax = true,
  partial = false,
  layout = 'inline',
  className,
}: ScoreGaugeProps) {
  const height = TRACK_HEIGHT[size]
  const radius = `calc(${height} / 2)`
  const stacked = layout === 'stacked'
  const trackSizeStyle = stacked ? { width: '100%' } : { width: trackWidth }

  if (value === null) {
    return (
      <span
        className={cn(
          stacked ? 'flex flex-col gap-2' : 'inline-flex items-center gap-2.5',
          className,
        )}
      >
        <span className={cn(NUMBER_CLASS[size], 'text-fg-subtle')}>—</span>
        <span
          aria-hidden="true"
          className="box-border block border border-dashed border-line-strong"
          style={{ ...trackSizeStyle, height, borderRadius: radius }}
        />
        <span className="sr-only">оценки нет</span>
      </span>
    )
  }

  const level = scoreLevel(value)
  const word = scoreWord(value)

  const track = (
    <span
      aria-hidden="true"
      className="block overflow-hidden"
      style={{
        ...trackSizeStyle,
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
  )

  const numberBlock = (
    <span className="flex items-baseline gap-1.5">
      <span className={NUMBER_CLASS[size]}>{formatScore(value)}</span>
      {showMax ? (
        <span className="text-[14px] text-fg-subtle">/ {SCORE_MAX}</span>
      ) : (
        <span className="sr-only">из {SCORE_MAX}</span>
      )}
    </span>
  )

  if (stacked) {
    return (
      <span className={cn('flex flex-col gap-2', className)}>
        {numberBlock}
        {track}
        {showWord ? (
          <span className="text-meta text-fg-muted">{word}</span>
        ) : (
          <span className="sr-only">{word}</span>
        )}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {numberBlock}
      {track}
      {showWord ? (
        <span className="text-meta text-fg-muted">{word}</span>
      ) : (
        <span className="sr-only">{word}</span>
      )}
    </span>
  )
}
