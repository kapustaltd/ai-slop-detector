import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { TeamPage } from './team-page'

function renderTeam(initialEntry = '/team/team-01') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/team/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TeamPage', () => {
  it('показывает заголовок, дисклеймер, итог и метаданные', async () => {
    renderTeam()

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'Команда 01' })).toBeInTheDocument(),
      { timeout: 10_000 },
    )
    expect(screen.getByText('Это вспомогательная метрика, а не вердикт')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Метаданные оценки' })).toBeInTheDocument()
  })

  it('показывает разбор по рубрике для каждой оценённой области', async () => {
    renderTeam()

    await waitFor(
      () => expect(screen.getByText('Разбор по рубрике · backend')).toBeInTheDocument(),
      { timeout: 10_000 },
    )
  })

  it('показывает «команда не найдена» для отсутствующего id', async () => {
    renderTeam('/team/does-not-exist')

    await waitFor(() => expect(screen.getByText('Команда не найдена')).toBeInTheDocument(), {
      timeout: 10_000,
    })
  })
})
