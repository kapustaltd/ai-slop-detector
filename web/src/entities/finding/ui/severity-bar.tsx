import type { FindingView } from '@/shared/api'

import { SEVERITY_CHART_VAR, SEVERITY_ORDER, SEVERITY_PLURAL_LABEL } from '../model/severity'

/**
 * Полоса распределения проблем по серьёзности — `design/reference/screens/04-team-light.html`.
 * Сегменты — настоящие `button` с `aria-label` (DESIGN.md: не canvas/svg, «сегменты должны быть
 * button»). Ширина пропорциональна количеству; повторный клик по активному сегменту снимает
 * фильтр.
 */

type Severity = FindingView['severity']

export interface SeverityBarProps {
  counts: Record<Severity, number>
  activeSeverity: 'all' | Severity
  onSelect: (severity: 'all' | Severity) => void
  className?: string
}

export function SeverityBar({ counts, activeSeverity, onSelect, className }: SeverityBarProps) {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + counts[severity], 0)

  const toggle = (severity: Severity) => onSelect(activeSeverity === severity ? 'all' : severity)

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="text-[13.5px] text-fg-muted">
        Проблемы по серьёзности — клик по сегменту фильтрует список
      </div>
      {total === 0 ? (
        <div className="h-3.5 rounded-[6px] border border-dashed border-line-strong" />
      ) : (
        <div className="flex h-11 gap-0.5 xl:h-10">
          {SEVERITY_ORDER.filter((severity) => counts[severity] > 0).map((severity, index, arr) => (
            <button
              key={severity}
              type="button"
              aria-label={`${SEVERITY_PLURAL_LABEL[severity]}: ${counts[severity]} — показать только их`}
              aria-pressed={activeSeverity === severity}
              onClick={() => toggle(severity)}
              className="relative h-full"
              style={{
                width: `${(counts[severity] / total) * 100}%`,
              }}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-1/2 h-3.5 -translate-y-1/2 ${
                  index === 0
                    ? 'rounded-l-[6px]'
                    : index === arr.length - 1
                      ? 'rounded-r-[6px]'
                      : ''
                }`}
                style={{
                  background: SEVERITY_CHART_VAR[severity],
                  outline: activeSeverity === severity ? '2px solid var(--ds-fg)' : undefined,
                  outlineOffset: activeSeverity === severity ? '1px' : undefined,
                }}
              />
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-3.5 gap-y-2">
        {SEVERITY_ORDER.map((severity) => (
          <span key={severity} className="flex items-center gap-[5px] text-[13.5px] text-fg-muted">
            <span
              aria-hidden="true"
              className="block h-[9px] w-[9px] rounded-[2px]"
              style={{ background: SEVERITY_CHART_VAR[severity] }}
            />
            {SEVERITY_PLURAL_LABEL[severity]}{' '}
            <span className="tabular-nums text-fg">{counts[severity]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
