import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadTeam } from '@/shared/api'

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

afterEach(() => vi.unstubAllGlobals())

describe('TeamPage', () => {
  it('shows a published area while the rest of the team is still processing', async () => {
    const fixture = await loadTeam('team-01')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/bundle/index')
          return new Response(
            JSON.stringify({ teams: [{ team_id: 'team-01', status: 'running' }] }),
            { status: 200 },
          )
        if (url === '/api/bundle/teams/team-01')
          return new Response(
            JSON.stringify({
              ...fixture,
              status: 'running',
              total: null,
              partial: true,
              areas: { backend: fixture.areas.backend },
            }),
            { status: 200 },
          )
        return new Response(null, { status: 404 })
      }),
    )
    renderTeam()
    expect(await screen.findByText(/Оценка продолжается/)).toBeInTheDocument()
    expect(await screen.findByText('Разбор по рубрике · backend')).toBeInTheDocument()
    expect(screen.queryByText('Разбор по рубрике · frontend')).not.toBeInTheDocument()
  })

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
