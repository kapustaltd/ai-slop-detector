import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { TeamArea, TeamBundle } from '@/shared/api'

import { ScoreSummary } from './score-summary'

function area(overrides: Partial<TeamArea>): TeamArea {
  return { status: 'done', score: 8.2, max: 10, categories: [], ...overrides }
}

function team(overrides: Partial<TeamBundle>): TeamBundle {
  return {
    bundle_schema: '0.1',
    built_at: '2026-09-21T12:00:00Z',
    team_id: 'team-01',
    name: 'Команда 01',
    status: 'done',
    total: 8,
    partial: false,
    areas: { backend: area({}), frontend: area({ score: 7.8 }) },
    ...overrides,
  }
}

describe('ScoreSummary', () => {
  it('показывает итог и по карточке на каждую область', () => {
    render(<ScoreSummary team={team({})} />)

    expect(screen.getByText('8.0')).toBeInTheDocument()
    expect(screen.getByText('8.2')).toBeInTheDocument()
    expect(screen.getByText('7.8')).toBeInTheDocument()
  })

  it('показывает понятный статус и причину для области без завершённой оценки', () => {
    render(
      <ScoreSummary
        team={team({ areas: { backend: area({ status: 'no_data', score: null }) } })}
      />,
    )

    expect(screen.getByText('Не оценён')).toBeInTheDocument()
    expect(screen.getByText('Причина: Причина не указана')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
  })

  it('называет частичный результат предварительным и объясняет неоценённую область', () => {
    render(
      <ScoreSummary
        team={team({
          total: 4.9,
          partial: true,
          areas: {
            backend: area({ score: null, status: 'no_data', error: undefined }),
            frontend: area({ score: 4.9 }),
          },
        })}
      />,
    )

    expect(screen.getByText('Предварительная оценка')).toBeInTheDocument()
    expect(screen.getByText('Оценена 1 из 2 областей')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('Причина: Причина не указана')).toBeInTheDocument()
  })
})
