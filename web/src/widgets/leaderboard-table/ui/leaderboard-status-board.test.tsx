import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { LeaderboardTeam } from '@/shared/api'

import { LeaderboardStatusBoard } from './leaderboard-status-board'

function team(overrides: Partial<LeaderboardTeam>): LeaderboardTeam {
  return {
    team_id: 'team-x',
    name: 'Команда X',
    rank: null,
    total: null,
    areas: {},
    status: 'no_data',
    partial: false,
    ...overrides,
  }
}

describe('LeaderboardStatusBoard', () => {
  it('считает частичные оценки отдельной категорией и показывает пять статусов', () => {
    render(
      <LeaderboardStatusBoard
        teams={[
          team({ team_id: 'queued', status: 'no_data' }),
          team({ team_id: 'running', status: 'running' }),
          team({ team_id: 'ready', status: 'done' }),
          team({ team_id: 'partial', status: 'done', partial: true }),
          team({ team_id: 'failed', status: 'failed' }),
        ]}
        activeStatus="all"
        onStatusChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'В очереди: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Проверяется: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Готово: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Частично: 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ошибка: 1' })).toBeInTheDocument()
  })

  it('анимирует иконку «Проверяется» в сводке', () => {
    render(
      <LeaderboardStatusBoard
        teams={[team({ status: 'running' })]}
        activeStatus="all"
        onStatusChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Проверяется: 1' }).querySelector('svg'),
    ).toHaveClass('animate-spin')
  })

  it('переключает фильтр частичных оценок', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <LeaderboardStatusBoard
        teams={[team({ status: 'done', partial: true })]}
        activeStatus="all"
        onStatusChange={onStatusChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Частично: 1' }))
    expect(onStatusChange).toHaveBeenCalledWith('partial')
  })
})
