import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { LeaderboardTeam } from '@/shared/api'

import { LeaderboardRowCard } from './leaderboard-row-card'

function team(overrides: Partial<LeaderboardTeam>): LeaderboardTeam {
  return {
    team_id: 'team-x',
    name: 'Команда X',
    rank: 1,
    total: 8.6,
    areas: { backend: 8.7, frontend: 8.5 },
    status: 'done',
    partial: false,
    ...overrides,
  }
}

describe('LeaderboardRowCard', () => {
  it('держит место, название и итог в одной строке (FR-015)', () => {
    render(
      <MemoryRouter>
        <LeaderboardRowCard team={team({})} />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /Команда X/ })
    expect(link).toHaveTextContent('1')
    expect(link).toHaveTextContent('8.6')
    expect(link).toHaveAttribute('href', '/team/team-x')
  })

  it('показывает backend и frontend', () => {
    render(
      <MemoryRouter>
        <LeaderboardRowCard team={team({})} />
      </MemoryRouter>,
    )

    expect(screen.getByText('backend')).toBeInTheDocument()
    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  it('показывает бейдж «Частично» для частичной оценки', () => {
    render(
      <MemoryRouter>
        <LeaderboardRowCard team={team({ partial: true, areas: { backend: 7.1 } })} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Частично')).toBeInTheDocument()
  })
})
