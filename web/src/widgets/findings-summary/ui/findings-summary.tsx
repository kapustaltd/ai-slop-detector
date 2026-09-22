import { SeverityBar } from '@/entities/finding'
import type { FindingView } from '@/shared/api'

import type { FindingCounts } from '../model/finding-counts'

/**
 * Распределение находок области — `design/reference/screens/04-team-light.html`. Композиция
 * счётчиков + `SeverityBar` (005-инвентарь).
 */

export interface FindingsSummaryProps {
  counts: FindingCounts
  activeSeverity: 'all' | FindingView['severity']
  onSeverityChange: (severity: 'all' | FindingView['severity']) => void
}

export function FindingsSummary({
  counts,
  activeSeverity,
  onSeverityChange,
}: FindingsSummaryProps) {
  const total = counts.strength + counts.issue

  return (
    <section
      aria-label="Распределение находок"
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-medium">Находки по всей области</span>
        <span className="text-[13.5px] text-fg-subtle">{total} всего</span>
      </div>

      <div className="flex gap-2.5">
        <div className="flex-grow rounded-[9px] border border-sev-strength-border bg-sev-strength-bg px-3 py-2.5">
          <div className="text-count text-sev-strength-fg">{counts.strength}</div>
          <div className="text-[13.5px] text-sev-strength-fg">сильных сторон</div>
        </div>
        <div className="flex-grow rounded-[9px] border border-line bg-muted-surface px-3 py-2.5">
          <div className="text-count">{counts.issue}</div>
          <div className="text-[13.5px] text-fg-muted">проблемы</div>
        </div>
      </div>

      <SeverityBar
        counts={{
          critical: counts.critical,
          major: counts.major,
          minor: counts.minor,
          info: counts.info,
        }}
        activeSeverity={activeSeverity}
        onSelect={onSeverityChange}
      />

      <div className="border-t border-line pt-2.5 text-[13.5px] leading-[1.5] text-fg-subtle">
        Количество находок не входит в балл: это следы, по которым балл можно проверить.
      </div>
    </section>
  )
}
