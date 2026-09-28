import { ChevronDown, ChevronRight, EllipsisIcon } from 'lucide-react'

import { ScoreGauge } from '@/shared/ui'

import { isLowConfidence } from '../model/contribution'

/**
 * Строка узла таксономии — одна на все три уровня (DESIGN.md: «строка узла одинакова на всех
 * трёх уровнях... уровень задаёт отступ, кегль и толщину дорожки»). Значения композиции —
 * `design/reference/screens/04-team-light.html` (категория/подкатегория) и
 * `06-metric-drilldown.html` (метрика, в т.ч. развёрнутая шапка).
 */

export interface TaxonomyRowProps {
  level: 1 | 2 | 3
  name: string
  description?: string // только уровень 2 — подпись под названием подкатегории
  idSlug?: string // только уровень 3, развёрнуто — `security.authz.resource-level`
  weight: number
  weightLabel: string // «вес 0.18» / «вес 0.60 внутри категории» / «вес 0.40 в подкатегории»
  weightContext?: string // только уровень 3, развёрнуто — «= 0.031 от backend»
  score: number | null
  contribution?: { value: number; ofTotal: number; label: string } // «вклад в backend 1.55 из 8.20»
  trailing?: string // «5 находок» / «3 метрики» — не показывается, когда узел развёрнут
  confidence?: 'high' | 'medium' | 'low' // только уровень 3
  expanded: boolean
  onToggle: () => void
  className?: string
}

const LEVEL_PADDING: Record<1 | 2 | 3, string> = {
  1: 'py-[13px] pl-4',
  2: 'py-[11px] pl-[46px]',
  3: 'py-[9px] pl-[68px]',
}

const LEVEL_NAME_CLASS: Record<1 | 2 | 3, string> = {
  1: 'text-[16px] font-medium',
  2: 'text-[15px]',
  3: 'text-[15px]',
}

export function TaxonomyRow({
  level,
  name,
  description,
  idSlug,
  weight,
  weightLabel,
  weightContext,
  score,
  contribution,
  trailing,
  confidence,
  expanded,
  onToggle,
  className,
}: TaxonomyRowProps) {
  const lowConfidence = confidence != null && isLowConfidence(confidence)
  const isExpandedMetricHeader = level === 3 && expanded

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={`flex w-full items-start gap-3.5 pr-4 text-left ${LEVEL_PADDING[level]} ${
        isExpandedMetricHeader ? 'bg-muted-open' : level === 2 ? 'bg-muted-open' : 'bg-surface'
      } ${lowConfidence ? 'border-dashed' : ''} ${className ?? ''}`}
    >
      <span className={`mt-0.5 flex shrink-0 text-fg-subtle ${level === 1 ? 'text-fg-muted' : ''}`}>
        {expanded ? (
          <ChevronDown aria-hidden="true" size={level === 1 ? 14 : 13} strokeWidth={2.2} />
        ) : (
          <ChevronRight aria-hidden="true" size={level === 1 ? 14 : 13} strokeWidth={2.2} />
        )}
      </span>

      {level === 3 ? (
        <span className="mt-0.5 w-[38px] shrink-0 text-[12.5px] tracking-[0.05em] text-fg-subtle uppercase">
          3 ур.
        </span>
      ) : null}

      <span
        className={`flex shrink-0 flex-col gap-[5px] ${level === 1 ? 'w-[270px]' : 'w-[260px]'}`}
      >
        <span className={LEVEL_NAME_CLASS[level]}>{name}</span>
        {description ? <span className="text-[13px] text-fg-subtle">{description}</span> : null}
        {isExpandedMetricHeader && idSlug ? (
          <span className="font-mono text-[13px] text-fg-subtle">{idSlug}</span>
        ) : null}
      </span>

      <span className="mt-0.5 flex w-[230px] shrink-0 items-center gap-2 text-[13.5px] text-fg-muted">
        {/* Ширина бара ограничена сверху: вес подкатегории/метрики внутри родителя (0.4–1.0)
            иначе почти полностью съедал бы колонку, не оставляя места подписи. */}
        <span
          aria-hidden="true"
          className="block h-1 shrink-0 rounded-[2px] bg-brand"
          style={{
            width: Math.min(56, Math.max(8, weight * 100)),
            opacity: level === 1 ? 0.55 : 0.4,
          }}
        />
        <span className="tabular-nums">
          {weightLabel}
          {weightContext ? (
            <>
              <br />
              <span className="text-fg-subtle">{weightContext}</span>
            </>
          ) : null}
        </span>
      </span>

      <ScoreGauge
        value={score}
        size={isExpandedMetricHeader ? 'row' : level === 1 ? 'inline' : 'micro'}
        trackWidth={level === 1 ? 120 : 100}
        showMax={isExpandedMetricHeader}
        showWord={false}
        className="shrink-0"
      />

      {contribution ? (
        <span className="mt-0.5 w-[210px] shrink-0 text-[13.5px] text-fg-muted tabular-nums">
          {contribution.label} <span className="text-fg">{contribution.value.toFixed(2)}</span> из{' '}
          {contribution.ofTotal.toFixed(2)}
        </span>
      ) : null}

      {lowConfidence ? (
        <span
          className="mt-0.5 flex shrink-0 items-center gap-[3px] text-fg-subtle"
          title="Уверенность модели низкая"
        >
          <EllipsisIcon aria-hidden="true" size={14} strokeWidth={2.2} />
          <span className="sr-only">уверенность низкая</span>
        </span>
      ) : null}

      {!expanded && trailing ? (
        <span className="mt-0.5 flex-grow text-right text-[13.5px] text-fg-subtle">{trailing}</span>
      ) : null}
    </button>
  )
}
