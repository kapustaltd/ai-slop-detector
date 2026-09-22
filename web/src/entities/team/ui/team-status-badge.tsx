import type { EvaluationStatus } from '@/shared/api'

import { describeStatus, STATUS_TONE_CLASS } from '../model/status'

/**
 * Статус строки рейтинга. Иконка/тон/подписи/пояснения — в `entities/team/model/status.ts`,
 * здесь только разметка.
 */

export interface TeamStatusBadgeProps {
  status: EvaluationStatus
  partial?: boolean
  className?: string
}

export function TeamStatusBadge({ status, partial = false, className }: TeamStatusBadgeProps) {
  const { icon: Icon, tone, label, description } = describeStatus(status, partial)
  const descId = `team-status-desc-${status}-${partial ? 'partial' : 'full'}`

  return (
    <span
      title={description}
      aria-describedby={descId}
      className={`inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-badge border px-2 text-[13.5px] font-medium ${STATUS_TONE_CLASS[tone]} ${className ?? ''}`}
    >
      <Icon aria-hidden="true" size={12} strokeWidth={2.1} />
      {label}
      <span id={descId} className="sr-only">
        {description}
      </span>
    </span>
  )
}
