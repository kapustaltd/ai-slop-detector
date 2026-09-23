import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it } from 'vitest'

import { getLeaderboardIndex, loadTeam, type TeamBundle } from '@/shared/api'

import { TeamPage } from './team-page'

const firstTeam = getLeaderboardIndex().teams[0]!
let teamBundle: TeamBundle

beforeAll(async () => {
  teamBundle = await loadTeam(firstTeam.team_id)
})

function renderTeam(initialEntry = `/team/${firstTeam.team_id}`) {
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
      () => expect(screen.getByRole('heading', { name: firstTeam.name })).toBeInTheDocument(),
      { timeout: 10_000 },
    )
    expect(screen.getByText('Это вспомогательная метрика, а не вердикт')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Метаданные оценки' })).toBeInTheDocument()
  })

  it('показывает разбор по рубрике для каждой оценённой области', async () => {
    renderTeam()

    const doneArea = Object.entries(teamBundle.areas).find(
      ([, area]) => area.status === 'done',
    )?.[0]
    expect(doneArea).toBeDefined()

    await waitFor(
      () => expect(screen.getByText(`Разбор по рубрике · ${doneArea}`)).toBeInTheDocument(),
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
