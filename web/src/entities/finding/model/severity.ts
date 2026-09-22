import type { FindingView } from '@/shared/api'

/** Токены `--ds-sev-*` и подписи по серьёзности — общий словарь для `FindingCard`/`SeverityBar`. */

export const SEVERITY_LABEL: Record<FindingView['severity'], string> = {
  critical: 'Критическая',
  major: 'Серьёзная',
  minor: 'Незначительная',
  info: 'Информационная',
}

export const SEVERITY_BORDER: Record<FindingView['severity'], string> = {
  critical: 'border-sev-critical-border',
  major: 'border-sev-major-border',
  minor: 'border-sev-minor-border',
  info: 'border-sev-info-border',
}

export const SEVERITY_BG: Record<FindingView['severity'], string> = {
  critical: 'bg-sev-critical-bg',
  major: 'bg-sev-major-bg',
  minor: 'bg-sev-minor-bg',
  info: 'bg-sev-info-bg',
}

export const SEVERITY_FG: Record<FindingView['severity'], string> = {
  critical: 'text-sev-critical-fg',
  major: 'text-sev-major-fg',
  minor: 'text-sev-minor-fg',
  info: 'text-sev-info-fg',
}

/** От самой серьёзной к наименее — порядок сегментов `SeverityBar` и списка находок. */
export const SEVERITY_ORDER: FindingView['severity'][] = ['critical', 'major', 'minor', 'info']

/** Склонение для легенды распределения (`SeverityBar`) — отдельно от подписи бейджа находки. */
export const SEVERITY_PLURAL_LABEL: Record<FindingView['severity'], string> = {
  critical: 'критические',
  major: 'серьёзные',
  minor: 'незначительные',
  info: 'информационные',
}

/** `--ds-sev-*-chart` — не выведены в Tailwind `@theme inline`, только сырые CSS-переменные. */
export const SEVERITY_CHART_VAR: Record<FindingView['severity'], string> = {
  critical: 'var(--ds-sev-critical-chart)',
  major: 'var(--ds-sev-major-chart)',
  minor: 'var(--ds-sev-minor-chart)',
  info: 'var(--ds-sev-info-chart)',
}
