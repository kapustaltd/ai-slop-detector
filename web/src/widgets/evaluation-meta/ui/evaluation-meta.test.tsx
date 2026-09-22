import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TeamBundle } from '@/shared/api'

import { EvaluationMeta } from './evaluation-meta'

function team(overrides: Partial<TeamBundle>): TeamBundle {
  return {
    bundle_schema: '0.1',
    built_at: '2026-09-21T12:00:00Z',
    team_id: 'team-01',
    name: 'Команда 01',
    status: 'done',
    commit_sha: 'a91b73e4c2f81d09b7',
    total: 8,
    partial: false,
    areas: {},
    meta: {
      schema_version: 'evaluation.v1',
      skill_version: '0.9.3',
      rubric_version: 'backend.v1 + frontend.v1',
      model: 'claude-sonnet-5',
      evaluated_at: '2026-09-21T14:07:00+07:00',
    },
    ...overrides,
  }
}

describe('EvaluationMeta', () => {
  it('показывает SHA, версии, модель и время (FR-017)', () => {
    render(<EvaluationMeta team={team({})} />)

    expect(screen.getByText('a91b73e4c2f81d09b7')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-5')).toBeInTheDocument()
    expect(screen.getByText('0.9.3')).toBeInTheDocument()
    expect(screen.getByText('evaluation.v1')).toBeInTheDocument()
  })

  it('не показывает блок предупреждений без warnings', () => {
    render(<EvaluationMeta team={team({ warnings: [] })} />)
    expect(screen.queryByText('Предупреждения оценки')).not.toBeInTheDocument()
  })

  it('показывает предупреждения с пояснением (FR-018)', () => {
    render(<EvaluationMeta team={team({ warnings: ['suspected_prompt_injection'] })} />)

    expect(screen.getByText('Предупреждения оценки')).toBeInTheDocument()
    expect(screen.getByText('Влияние на оценку')).toBeInTheDocument()
  })
})
