import { describe, expect, it } from 'vitest'

import type { FindingView } from '@/shared/api'

import { findingSlug, linkState } from './link-state'

function finding(overrides: Partial<FindingView>): FindingView {
  return {
    kind: 'issue',
    severity: 'major',
    file: 'src/orders/orders.controller.ts',
    line_start: 41,
    line_end: 51,
    title: 'Заказ возвращается без проверки владельца',
    explanation: '...',
    ...overrides,
  }
}

describe('linkState', () => {
  it('verified: permalink есть и link_status verified', () => {
    expect(linkState(finding({ permalink: 'https://x', link_status: 'verified' }))).toBe('verified')
  })

  it('no-permalink: permalink отсутствует, независимо от link_status', () => {
    expect(linkState(finding({ permalink: undefined, link_status: 'verified' }))).toBe(
      'no-permalink',
    )
    expect(linkState(finding({ permalink: undefined, link_status: undefined }))).toBe(
      'no-permalink',
    )
  })

  it.each(['unverified', 'missing_file', 'invalid_range', 'unsafe_path'] as const)(
    'unverified: permalink есть, link_status=%s',
    (status) => {
      expect(linkState(finding({ permalink: 'https://x', link_status: status }))).toBe('unverified')
    },
  )

  it('unverified: permalink есть, link_status не указан', () => {
    expect(linkState(finding({ permalink: 'https://x', link_status: undefined }))).toBe(
      'unverified',
    )
  })
})

describe('findingSlug', () => {
  it('собирает слаг из файла и диапазона строк', () => {
    expect(findingSlug(finding({}))).toBe('src/orders/orders.controller.ts:41-51')
  })
})
