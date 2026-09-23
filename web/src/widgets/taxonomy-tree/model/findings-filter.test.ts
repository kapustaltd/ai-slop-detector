import { describe, expect, it } from 'vitest'

import { parseFindingsFilter } from './findings-filter'

describe('parseFindingsFilter', () => {
  it('разбирает известные значения kind/severity', () => {
    expect(parseFindingsFilter(new URLSearchParams('?kind=issue&severity=critical'))).toEqual({
      kind: 'issue',
      severity: 'critical',
    })
  })

  it('неизвестное/отсутствующее значение трактуется как all', () => {
    expect(parseFindingsFilter(new URLSearchParams('?kind=bogus'))).toEqual({
      kind: 'all',
      severity: 'all',
    })
    expect(parseFindingsFilter(new URLSearchParams(''))).toEqual({ kind: 'all', severity: 'all' })
  })
})
