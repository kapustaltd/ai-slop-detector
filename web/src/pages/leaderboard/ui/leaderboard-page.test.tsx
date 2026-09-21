import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { LeaderboardPage } from './leaderboard-page'

describe('LeaderboardPage', () => {
  it('отрисовывает команды из фикстурного бандла', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Рейтинг команд' })).toBeInTheDocument()
    expect(screen.getByText('Команда 01')).toBeInTheDocument()
  })

  it('показывает прочерк вместо балла у неоценённой команды', () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
