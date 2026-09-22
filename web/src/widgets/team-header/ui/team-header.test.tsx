import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { TeamBundle } from '@/shared/api'

import type { TeamRankContext } from '../model/rank-context'
import { TeamHeader } from './team-header'

function team(overrides: Partial<TeamBundle>): TeamBundle {
  return {
    bundle_schema: '0.1',
    built_at: '2026-09-21T12:00:00Z',
    team_id: 'team-01',
    name: 'Команда 01',
    status: 'done',
    total: 8,
    partial: false,
    areas: {},
    ...overrides,
  }
}

const emptyRank: TeamRankContext = {
  rank: null,
  totalTeams: 0,
  tiedWith: [],
  previousTeamId: null,
  nextTeamId: null,
}

describe('TeamHeader', () => {
  it('показывает хлебные крошки и статус всегда', () => {
    render(
      <MemoryRouter>
        <TeamHeader team={team({})} rankContext={emptyRank} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Рейтинг' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Команда 01' })).toBeInTheDocument()
  })

  it('не показывает блок ранга и prev/next, когда rankContext пуст', () => {
    render(
      <MemoryRouter>
        <TeamHeader team={team({})} rankContext={emptyRank} />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/Место в рейтинге/)).not.toBeInTheDocument()
    expect(screen.queryByText('Предыдущая команда')).not.toBeInTheDocument()
  })

  it('показывает место в рейтинге и prev/next, когда rankContext заполнен', () => {
    render(
      <MemoryRouter>
        <TeamHeader
          team={team({})}
          rankContext={{
            rank: 2,
            totalTeams: 24,
            tiedWith: ['Вектор'],
            previousTeamId: 'team-00',
            nextTeamId: 'team-02',
          }}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Место в рейтинге/)).toBeInTheDocument()
    expect(screen.getByText(/также «Вектор»/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Предыдущая команда/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Следующая команда/ })).toBeInTheDocument()
  })
})
