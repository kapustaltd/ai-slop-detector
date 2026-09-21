import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TeamPage } from './team-page'

function renderTeam() {
  return render(
    <MemoryRouter initialEntries={['/team/team-01']}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeamPage', () => {
  it('показывает итог, метаданные и таксономию команды', async () => {
    renderTeam()

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Команда 01' })).toBeInTheDocument(),
      { timeout: 10_000 },
    )
    expect(screen.getByText('Метаданные оценки')).toBeInTheDocument()
    expect(screen.getByText('Детализация backend')).toBeInTheDocument()
    expect(screen.getByText('Детализация frontend')).toBeInTheDocument()
  })

  it('помечает недостаток данных для сравнительных графиков', async () => {
    renderTeam()

    await waitFor(
      () =>
        expect(screen.getAllByText('Недостаточно оценённых команд для сравнения.')).toHaveLength(2),
      { timeout: 10_000 },
    )
  })
})
