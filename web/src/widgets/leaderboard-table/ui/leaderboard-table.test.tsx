import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { LeaderboardTeam } from '@/shared/api'

import { LeaderboardTable } from './leaderboard-table'

function team(overrides: Partial<LeaderboardTeam>): LeaderboardTeam {
  return {
    team_id: 'team-x',
    name: 'Команда X',
    rank: 1,
    total: 5,
    areas: {},
    status: 'done',
    partial: false,
    ...overrides,
  }
}

function renderTable(teams: LeaderboardTeam[]) {
  return render(
    <MemoryRouter>
      <LeaderboardTable teams={teams} sort={{ key: 'rank', direction: 'asc' }} onSort={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('LeaderboardTable', () => {
  it('показывает колонки место/команда/итог/backend/frontend/статус/признаки (FR-001)', () => {
    renderTable([team({ team_id: 'a', name: 'Команда А' })])

    expect(screen.getByRole('columnheader', { name: '№' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Итог/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Backend/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Frontend/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Признаки' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Команда А' })).toHaveAttribute('href', '/team/a')
  })

  it('отмечает равные места знаком «=»', () => {
    renderTable([
      team({ team_id: 'a', rank: 2, total: 7 }),
      team({ team_id: 'b', rank: 2, total: 7 }),
    ])

    expect(screen.getAllByText('=')).toHaveLength(1)
  })

  it('не показывает отсутствующую область как ноль (FR-006)', () => {
    renderTable([team({ team_id: 'a', areas: { backend: 7 } })])

    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
  })
})
