import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LeaderboardToolbar } from './leaderboard-toolbar'

describe('LeaderboardToolbar', () => {
  it('показывает счётчик показанных строк через aria-live', () => {
    render(
      <LeaderboardToolbar
        filters={{ status: 'all', warningsOnly: false }}
        onFiltersChange={vi.fn()}
        sort={{ key: 'rank', direction: 'asc' }}
        onSort={vi.fn()}
        shown={5}
        total={24}
      />,
    )

    const counter = screen.getByText('Показано: 5 из 24')
    expect(counter).toHaveAttribute('aria-live', 'polite')
  })

  it('сообщает об изменении фильтра статуса', async () => {
    const onFiltersChange = vi.fn()
    const user = userEvent.setup()
    render(
      <LeaderboardToolbar
        filters={{ status: 'all', warningsOnly: false }}
        onFiltersChange={onFiltersChange}
        sort={{ key: 'rank', direction: 'asc' }}
        onSort={vi.fn()}
        shown={24}
        total={24}
      />,
    )

    await user.selectOptions(screen.getByDisplayValue('Статус: все'), 'failed')
    expect(onFiltersChange).toHaveBeenCalledWith({ status: 'failed' })
  })

  it('сообщает о переключении «только с предупреждениями»', async () => {
    const onFiltersChange = vi.fn()
    const user = userEvent.setup()
    render(
      <LeaderboardToolbar
        filters={{ status: 'all', warningsOnly: false }}
        onFiltersChange={onFiltersChange}
        sort={{ key: 'rank', direction: 'asc' }}
        onSort={vi.fn()}
        shown={24}
        total={24}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: /предупреждениями/ }))
    expect(onFiltersChange).toHaveBeenCalledWith({ warningsOnly: true })
  })

  it('позволяет изменить направление сортировки на мобильном экране', async () => {
    const onSort = vi.fn()
    const user = userEvent.setup()
    render(
      <LeaderboardToolbar
        filters={{ status: 'all', warningsOnly: false }}
        onFiltersChange={vi.fn()}
        sort={{ key: 'backend', direction: 'desc' }}
        onSort={onSort}
        shown={5}
        total={5}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Направление сортировки: по убыванию/ }))
    expect(onSort).toHaveBeenCalledWith('backend')
  })
})
