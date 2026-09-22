import type { FindingView } from '@/shared/api'

/** `?kind=&severity=` — фильтр находок, общий для `TaxonomyTree` и `FindingsSummary`. */
export interface FindingsFilter {
  kind: 'all' | FindingView['kind']
  severity: 'all' | FindingView['severity']
}

export const DEFAULT_FINDINGS_FILTER: FindingsFilter = { kind: 'all', severity: 'all' }

const KINDS: FindingView['kind'][] = ['strength', 'issue']
const SEVERITIES: FindingView['severity'][] = ['info', 'minor', 'major', 'critical']

export function parseFindingsFilter(searchParams: URLSearchParams): FindingsFilter {
  const kind = searchParams.get('kind')
  const severity = searchParams.get('severity')
  return {
    kind:
      kind != null && (KINDS as string[]).includes(kind) ? (kind as FindingView['kind']) : 'all',
    severity:
      severity != null && (SEVERITIES as string[]).includes(severity)
        ? (severity as FindingView['severity'])
        : 'all',
  }
}
