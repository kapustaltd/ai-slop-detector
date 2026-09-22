import { describe, expect, it } from 'vitest'

import type { TeamArea } from '@/shared/api'

import { countFindings } from './finding-counts'

function area(): TeamArea {
  return {
    status: 'done',
    score: 8,
    max: 10,
    categories: [
      {
        id: 'c1',
        name: 'c1',
        weight: 1,
        score: 8,
        subcategories: [
          {
            id: 's1',
            name: 's1',
            weight: 1,
            score: 8,
            metrics: [
              {
                id: 'm1',
                name: 'm1',
                weight: 1,
                score: 8,
                max: 10,
                confidence: 'high',
                summary: 's',
                rationale: 'r',
                findings: [
                  {
                    kind: 'strength',
                    severity: 'info',
                    file: 'a.ts',
                    line_start: 1,
                    line_end: 2,
                    title: 't',
                    explanation: 'e',
                  },
                  {
                    kind: 'issue',
                    severity: 'critical',
                    file: 'b.ts',
                    line_start: 1,
                    line_end: 2,
                    title: 't2',
                    explanation: 'e2',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('countFindings', () => {
  it('считает kind и severity по всем метрикам области', () => {
    const counts = countFindings(area())
    expect(counts).toEqual({ strength: 1, issue: 1, info: 1, minor: 0, major: 0, critical: 1 })
  })
})
