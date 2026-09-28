import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'

import { cn } from 'cn'

import { SCORE_MAX, formatScore, scoreFillPercent } from '@/shared/lib'

export interface ScoreRingProps {
  value: number | null
  label?: string
  size?: 'compact' | 'large'
  className?: string
}

export function ScoreRing({
  value,
  label = 'Итоговая оценка',
  size = 'large',
  className,
}: ScoreRingProps) {
  const percent = value == null ? 0 : scoreFillPercent(value)
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setAnimatedPercent(percent))
    return () => window.cancelAnimationFrame(frame)
  }, [percent])

  const style = { '--score-angle': `${value == null ? 0 : animatedPercent}%` } as CSSProperties
  const scoreText = value == null ? 'оценки нет' : `${formatScore(value)} из ${SCORE_MAX}`

  return (
    <div
      aria-label={label ? `${label}: ${scoreText}` : scoreText}
      className={cn(
        'score-ring',
        size === 'compact' ? 'score-ring-compact' : 'score-ring-large',
        className,
      )}
      data-empty={value == null ? 'true' : undefined}
      role="img"
      style={style}
    >
      <span aria-hidden="true" className="score-ring__inner" />
      <span className="score-ring__content">
        {label ? <span className="score-ring__label">{label}</span> : null}
        <span className="score-ring__value">{formatScore(value)}</span>
        <span className="score-ring__max">из {SCORE_MAX}</span>
      </span>
    </div>
  )
}
