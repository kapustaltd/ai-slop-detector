import {
  Check,
  CircleAlert,
  CircleDashed,
  CircleX,
  KeyRound,
  LoaderCircle,
  Minus,
  OctagonAlert,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { EvaluationStatus, LeaderboardTeam } from '@/shared/api'

/**
 * Подписи и сортировка строки рейтинга. Перенесено из прежней реализации
 * `pages/leaderboard/ui/leaderboard-page.tsx` без изменения поведения — только сюда, в
 * `entities/team`, чтобы переиспользовать на странице команды (006).
 */

export type SortKey = 'rank' | 'total' | 'backend' | 'frontend'
export type SortDirection = 'asc' | 'desc'

const STATUS_LABELS: Record<EvaluationStatus, string> = {
  done: 'Оценено',
  failed: 'Не удалось',
  no_data: 'Нет данных',
  running: 'Выполняется',
}

export function statusLabel(status: EvaluationStatus): string {
  return STATUS_LABELS[status]
}

export function normalizeStatus(value: string): EvaluationStatus {
  return value in STATUS_LABELS ? (value as EvaluationStatus) : 'no_data'
}

export type StatusTone = 'strength' | 'critical' | 'info' | 'neutral'

/** Токены `--ds-sev-*`/`--ds-border-strong` по тону — общий словарь для всех бейджей статуса. */
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  strength: 'border-sev-strength-border bg-sev-strength-bg text-sev-strength-fg',
  critical: 'border-sev-critical-border bg-sev-critical-bg text-sev-critical-fg',
  info: 'border-sev-info-border bg-sev-info-bg text-sev-info-fg',
  neutral: 'border-dashed border-line-strong bg-muted-surface text-fg-subtle',
}

export interface StatusPresentation {
  icon: LucideIcon
  tone: StatusTone
  label: string
  description: string
}

/**
 * Иконка/тон/подпись/пояснение по статусу строки рейтинга. Частичная оценка (`partial`) не
 * отдельный бейдж — на макете рейтинга (`01-leaderboard-light.html`, строка «Гринфилд») она
 * заменяет бейдж «Оценено» на «Частично» целиком (FR-003b: «не читается как равноправный с
 * полной оценкой» — замена бейджа передаёт это точнее, чем два бейджа рядом).
 */
export function describeStatus(status: EvaluationStatus, partial: boolean): StatusPresentation {
  if (status === 'done' && partial) {
    return {
      icon: CircleDashed,
      tone: 'info',
      label: 'Частично',
      description: 'Оценена только одна область — итог посчитан по ней, веса нормализованы.',
    }
  }
  if (status === 'done') {
    return {
      icon: Check,
      tone: 'strength',
      label: statusLabel(status),
      description: 'Оценка завершена.',
    }
  }
  if (status === 'failed') {
    return {
      icon: CircleX,
      tone: 'critical',
      label: statusLabel(status),
      description: 'Оценка не удалась. Повторный запуск доступен оператору.',
    }
  }
  if (status === 'running') {
    return {
      icon: LoaderCircle,
      tone: 'info',
      label: statusLabel(status),
      description: 'Оценка выполняется.',
    }
  }
  return {
    icon: Minus,
    tone: 'neutral',
    label: statusLabel(status),
    description: 'Данных нет — оценка ещё не проводилась.',
  }
}

/**
 * Словарь `warnings[]` (контракт 001, `evaluation-report.warnings`). Неизвестное значение — общий
 * текст, а не падение и не скрытие бейджа (research.md → «Словарь предупреждений»).
 */
const WARNING_LABELS: Record<string, string> = {
  suspected_prompt_injection: 'Влияние на оценку',
  repo_too_large: 'Лимит размера',
  file_limit_exceeded: 'Лимит размера',
  secret_redacted: 'Секрет скрыт',
  incomplete_area: 'Область оценена частично',
  provider_error: 'Ошибка модели',
}

const DEFAULT_WARNING_LABEL = 'Предупреждение оценки'

export function warningLabel(warning: string): string {
  return WARNING_LABELS[warning] ?? DEFAULT_WARNING_LABEL
}

const WARNING_ICONS: Record<string, LucideIcon> = {
  suspected_prompt_injection: ShieldAlert,
  repo_too_large: TriangleAlert,
  file_limit_exceeded: TriangleAlert,
  secret_redacted: KeyRound,
  incomplete_area: CircleAlert,
  provider_error: OctagonAlert,
}

export function warningIcon(warning: string): LucideIcon {
  return WARNING_ICONS[warning] ?? TriangleAlert
}

function sortValue(team: LeaderboardTeam, key: SortKey): number | null {
  if (key === 'rank') return team.rank
  if (key === 'total') return team.total
  return team.areas?.[key] ?? null
}

/**
 * Строки с отсутствующим значением остаются в хвосте независимо от направления (DESIGN.md,
 * «Нет данных»). Равные значения — детерминированный tie-break по `team_id` (FR-004).
 */
export function sortTeams(
  teams: LeaderboardTeam[],
  key: SortKey,
  direction: SortDirection,
): LeaderboardTeam[] {
  return [...teams].sort((left, right) => {
    const leftValue = sortValue(left, key)
    const rightValue = sortValue(right, key)
    if (leftValue == null && rightValue != null) return 1
    if (leftValue != null && rightValue == null) return -1
    if (leftValue != null && rightValue != null && leftValue !== rightValue) {
      return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue
    }
    return left.team_id.localeCompare(right.team_id)
  })
}
