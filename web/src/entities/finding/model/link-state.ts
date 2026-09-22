import type { FindingView } from '@/shared/api'

/**
 * Три состояния ссылки находки (research.md → «Три состояния ссылки») — вычисляются из двух
 * независимых полей `link_status`/`permalink`, а не из одного tri-state.
 */
export type LinkState = 'verified' | 'unverified' | 'no-permalink'

export function linkState(finding: FindingView): LinkState {
  if (!finding.permalink) return 'no-permalink'
  return finding.link_status === 'verified' ? 'verified' : 'unverified'
}

/** `${file}:${line_start}-${line_end}` — детерминированный в пределах одного TeamBundle. */
export function findingSlug(finding: FindingView): string {
  return `${finding.file}:${finding.line_start}-${finding.line_end}`
}
