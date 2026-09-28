import {
  Check,
  CircleAlert,
  CircleDashed,
  KeyRound,
  ShieldAlert,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { findingSlug } from '@/entities/finding'
import type { FindingView, LeaderboardTeam, TeamArea, TeamBundle } from '@/shared/api'

export const DETAIL_AREA_KEYS = ['backend', 'frontend'] as const
export type DetailAreaKey = (typeof DETAIL_AREA_KEYS)[number]

export const DETAIL_AREA_LABELS: Record<DetailAreaKey, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
}

type Warning = string

export interface TeamFindingContext {
  finding: FindingView
  area: DetailAreaKey
  categoryId: string
  subcategoryId: string
  metricId: string
  metricName: string
}

export interface DetailNote {
  key: string
  icon: LucideIcon
  title: string
  description: string
  tone: 'warn' | 'info' | 'critical'
}

export interface DetailInsight {
  context: TeamFindingContext
  label: 'Сильная сторона' | 'Приоритетная проблема'
}

export type SeverityCounts = Record<FindingView['severity'], number>
export type FindingKindCounts = Record<FindingView['kind'], number>

const SEVERITY_RANK: Record<FindingView['severity'], number> = {
  critical: 4,
  major: 3,
  minor: 2,
  info: 1,
}

export const SEVERITY_LABELS: Record<FindingView['severity'], string> = {
  critical: 'Критичные',
  major: 'Серьёзные',
  minor: 'Небольшие',
  info: 'Информационные',
}

export function getTeamFindings(team: TeamBundle | null): TeamFindingContext[] {
  if (!team) return []

  return Object.entries(team.areas).flatMap(([areaName, area]) => {
    if (!isDetailAreaKey(areaName)) return []
    return area.categories.flatMap((category) =>
      category.subcategories.flatMap((subcategory) =>
        subcategory.metrics.flatMap((metric) =>
          metric.findings.map((finding) => ({
            finding,
            area: areaName,
            categoryId: category.id,
            subcategoryId: subcategory.id,
            metricId: metric.id,
            metricName: metric.name,
          })),
        ),
      ),
    )
  })
}

export function getSeverityCounts(findings: TeamFindingContext[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, major: 0, minor: 0, info: 0 }
  for (const { finding } of findings) counts[finding.severity] += 1
  return counts
}

export function getFindingKindCounts(findings: TeamFindingContext[]): FindingKindCounts {
  const counts: FindingKindCounts = { strength: 0, issue: 0 }
  for (const { finding } of findings) counts[finding.kind] += 1
  return counts
}

export function getDetailInsights(findings: TeamFindingContext[]): DetailInsight[] {
  const strengths = findings
    .filter(({ finding }) => finding.kind === 'strength')
    .sort((left, right) => {
      const severity = SEVERITY_RANK[right.finding.severity] - SEVERITY_RANK[left.finding.severity]
      if (severity !== 0) return severity
      return left.metricName.localeCompare(right.metricName)
    })
  const issues = findings
    .filter(({ finding }) => finding.kind === 'issue')
    .sort((left, right) => {
      const severity = SEVERITY_RANK[right.finding.severity] - SEVERITY_RANK[left.finding.severity]
      if (severity !== 0) return severity
      return left.metricName.localeCompare(right.metricName)
    })

  return [
    ...(strengths[0] ? [{ context: strengths[0], label: 'Сильная сторона' as const }] : []),
    ...(issues[0] ? [{ context: issues[0], label: 'Приоритетная проблема' as const }] : []),
  ]
}

export function getAreaScore(
  summary: LeaderboardTeam,
  team: TeamBundle | null,
  areaName: DetailAreaKey,
): number | null {
  return summary.areas?.[areaName] ?? team?.areas[areaName]?.score ?? null
}

export function getAreaCoverageMessage(
  areaName: DetailAreaKey,
  area: TeamArea | undefined,
  warnings: Warning[],
  partial: boolean,
): string | null {
  if (area?.status === 'failed')
    return area.error ?? 'Область не оценена: проверка завершилась с ошибкой.'
  if (area?.status === 'running') return 'Область ещё проверяется.'
  if (!partial) return null
  if (!area) return `${DETAIL_AREA_LABELS[areaName]} не вошла в опубликованный итог.`
  if (warnings.includes('incomplete_area')) return 'В области остались непроверенные критерии.'
  if (warnings.includes('file_limit_exceeded'))
    return 'Часть файлов области пропущена из-за лимита.'
  if (warnings.includes('repo_too_large')) return 'Часть содержимого области не вошла в проверку.'
  return 'Покрытие области ограничено — подробности указаны в полном отчёте.'
}

export function getDetailNotes(summary: LeaderboardTeam, team: TeamBundle | null): DetailNote[] {
  const warnings = team?.warnings ?? summary.warnings ?? []
  const partial = team?.partial ?? summary.partial
  const notes: DetailNote[] = []

  if (partial) {
    const missingArea = DETAIL_AREA_KEYS.find(
      (areaName) => !team?.areas[areaName] && summary.areas?.[areaName] == null,
    )
    if (missingArea) {
      notes.push({
        key: `missing-${missingArea}`,
        icon: CircleAlert,
        title: `${DETAIL_AREA_LABELS[missingArea]} не оценена`,
        description:
          'Эта область не вошла в опубликованный итог; балл команды рассчитан по доступным данным.',
        tone: 'warn',
      })
    } else if (warnings.includes('incomplete_area')) {
      notes.push({
        key: 'incomplete-area',
        icon: CircleAlert,
        title: 'Покрытие области ограничено',
        description: 'Часть критериев области не проверена и не должна читаться как полная оценка.',
        tone: 'warn',
      })
    }
  }

  if (warnings.includes('repo_too_large') || warnings.includes('file_limit_exceeded')) {
    notes.push({
      key: 'size-limit',
      icon: TriangleAlert,
      title: 'Лимит размера',
      description: warnings.includes('repo_too_large')
        ? 'Репозиторий превысил лимит — часть содержимого не попала в проверку.'
        : 'Лимит файлов исключил часть файлов из проверки.',
      tone: 'warn',
    })
  }

  if (warnings.includes('secret_redacted')) {
    notes.push({
      key: 'secret-redacted',
      icon: KeyRound,
      title: 'Значение секрета скрыто',
      description:
        'В отчёте сохранено замаскированное значение; исходное значение не показывается.',
      tone: 'info',
    })
  }

  if (warnings.includes('suspected_prompt_injection')) {
    notes.push({
      key: 'prompt-injection',
      icon: ShieldAlert,
      title: 'Инструкции из репозитория',
      description: 'Они не влияли на оценку.',
      tone: 'critical',
    })
  }

  if (warnings.includes('provider_error')) {
    notes.push({
      key: 'provider-error',
      icon: TriangleAlert,
      title: 'Проверка сервиса',
      description: 'Сервис оценки вернул ошибку для части проверки.',
      tone: 'critical',
    })
  }

  return notes
}

export function getExecutionStatus(status: LeaderboardTeam['status']) {
  if (status === 'done') return { icon: Check, label: 'Проверка завершена' }
  if (status === 'running') return { icon: CircleDashed, label: 'Проверка выполняется' }
  if (status === 'failed') return { icon: XCircle, label: 'Проверка завершилась с ошибкой' }
  return { icon: CircleDashed, label: 'Проверка ещё не запускалась' }
}

export function findingHref(teamId: string, context: TeamFindingContext): string {
  const node = [context.categoryId, context.subcategoryId, context.metricId].join('.')
  const params = new URLSearchParams({
    area: context.area,
    node,
    finding: findingSlug(context.finding),
  })
  return `/team/${encodeURIComponent(teamId)}?${params.toString()}`
}

export function formatEvaluationTime(isoDate: string): { value: string; timeZone: string } {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return { value: '—', timeZone: '—' }

  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const zoneFormatter = new Intl.DateTimeFormat('ru-RU', { timeZoneName: 'long' })
  const timeZone = zoneFormatter
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value
  return {
    value: formatter.format(date),
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

function isDetailAreaKey(areaName: string): areaName is DetailAreaKey {
  return (DETAIL_AREA_KEYS as readonly string[]).includes(areaName)
}
