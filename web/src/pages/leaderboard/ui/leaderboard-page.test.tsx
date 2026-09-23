import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { getLeaderboardIndex } from '@/shared/api'

import { LeaderboardPage } from './leaderboard-page'

const bundle = getLeaderboardIndex()
const firstTeam = bundle.teams[0]!
const unratedTeam = bundle.teams.find((team) => team.total === null)
const warningTeam = bundle.teams.find((team) => (team.warnings?.length ?? 0) > 0)
const cleanTeam = bundle.teams.find((team) => (team.warnings?.length ?? 0) === 0)

describe('LeaderboardPage', () => {
  it('отрисовывает команды из текущего бандла и время сборки бандла (FR-011)', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText(firstTeam.name).length).toBeGreaterThan(0)
    expect(screen.getByText(/Данные собраны/)).toBeInTheDocument()
  })

  it.skipIf(!unratedTeam)('показывает прочерк вместо балла у неоценённой команды', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('переход по клику на команду ведёт на страницу команды (FR-010)', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    const link = screen.getAllByRole('link', { name: firstTeam.name })[0]
    expect(link).toHaveAttribute('href', `/team/${firstTeam.team_id}`)
  })

  it.skipIf(!warningTeam || !cleanTeam)(
    'фильтрует команды с предупреждениями из адреса страницы',
    () => {
      render(
        <MemoryRouter initialEntries={['/?warnings=1']}>
          <LeaderboardPage />
        </MemoryRouter>,
      )

      expect(screen.getAllByText(warningTeam!.name).length).toBeGreaterThan(0)
      expect(screen.queryByText(cleanTeam!.name)).not.toBeInTheDocument()
    },
  )

  it('переключает направление сортировки кликом по заголовку числовой колонки', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /Итог/ }))
    expect(screen.getByRole('columnheader', { name: /Итог/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('пустой результат фильтра показывает EmptyState со сбросом', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/?status=running&warnings=1']}>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Под фильтры не попала ни одна команда')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(screen.getAllByText(firstTeam.name).length).toBeGreaterThan(0)
  })
})
