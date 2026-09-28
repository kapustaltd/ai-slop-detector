import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LeaderboardPage } from './leaderboard-page'

afterEach(() => vi.unstubAllGlobals())

describe('LeaderboardPage', () => {
  it('shows a newly registered pending team from the live API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              bundle_schema: '0.1',
              built_at: '2026-09-23T10:00:00Z',
              meta: {
                bundle_schema: '0.1',
                built_at: '2026-09-23T10:00:00Z',
                report_schema: '1.0',
                rubric_versions: [],
                skill_versions: [],
                models: [],
              },
              teams: [
                {
                  team_id: 'new-team',
                  name: 'Новая команда',
                  rank: null,
                  total: null,
                  areas: {},
                  status: 'running',
                  partial: false,
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getAllByText('Новая команда').length).toBeGreaterThan(0))
    expect(screen.queryByText('Команда 01')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Новая команда' })).toHaveAttribute(
      'href',
      '/team/new-team',
    )
  })
  it('отрисовывает команды из фикстурного бандла (FR-011)', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Команда 01').length).toBeGreaterThan(0)
  })

  it('показывает на главной переход к добавлению команды', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Добавить команду' })).toHaveAttribute(
      'href',
      '/manage/teams',
    )
  })

  it('показывает прочерк вместо балла у неоценённой команды', () => {
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

    const link = screen.getAllByRole('link', { name: 'Команда 01' })[0]
    expect(link).toHaveAttribute('href', '/team/team-01')
  })

  it('фильтрует команды с предупреждениями из адреса страницы', () => {
    render(
      <MemoryRouter initialEntries={['/?warnings=1']}>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('Команда 02').length).toBeGreaterThan(0)
    expect(screen.queryByText('Команда 01')).not.toBeInTheDocument()
  })

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
    expect(screen.getAllByText('Команда 01').length).toBeGreaterThan(0)
  })
})
