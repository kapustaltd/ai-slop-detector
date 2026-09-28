import { describe, expect, it } from 'vitest'

import type { RegistryEvaluationProgress } from '@/shared/api'

import { effectiveProgressStatus, pipelineStatusFor } from './state'

const progress = (
  overrides: Partial<RegistryEvaluationProgress> = {},
): RegistryEvaluationProgress => ({
  status: 'done',
  stage: 'done',
  areas: [
    {
      area: 'backend',
      status: 'queued',
      included_files: 0,
      excluded_files: 0,
      completed_categories: 0,
      total_categories: 5,
    },
    {
      area: 'frontend',
      status: 'done',
      included_files: 12,
      excluded_files: 0,
      completed_categories: 4,
      total_categories: 4,
    },
  ],
  events: [],
  ...overrides,
})

describe('evaluation progress state', () => {
  it('does not expose a terminal status while an area is queued', () => {
    const value = progress()

    expect(effectiveProgressStatus(value)).toBe('running')
    expect(pipelineStatusFor(value, 'backend')).toBe('pending')
    expect(pipelineStatusFor(value, 'frontend')).toBe('done')
    expect(pipelineStatusFor(value, 'report')).toBe('pending')
  })

  it('treats an explicit no-data area as skipped', () => {
    const value = progress({
      areas: progress().areas.map((area) =>
        area.area === 'backend' ? { ...area, status: 'no_data' } : area,
      ),
    })

    expect(effectiveProgressStatus(value)).toBe('done')
    expect(pipelineStatusFor(value, 'backend')).toBe('skipped')
    expect(pipelineStatusFor(value, 'report')).toBe('done')
  })
})
