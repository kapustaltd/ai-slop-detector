import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RunnerPage } from './runner-page'

const completedJob = {
  id: 'run-123',
  status: 'succeeded',
  repository_url: 'https://github.com/example/repository.git',
  repository_id: 'team-01',
  branch: 'main',
  area: 'backend',
  progress: { backend: 'succeeded' },
  created_at: '2026-09-22T12:00:00Z',
  summary: {
    run_id: 'run-123',
    teams_total: 1,
    teams_done: 1,
    teams_failed: 0,
    areas_done: 1,
    areas_failed: 0,
    duration_ms: 1200,
    cost_usd: 0.01,
  },
} as const

function renderRunner() {
  return render(
    <MemoryRouter>
      <RunnerPage />
    </MemoryRouter>,
  )
}

describe('RunnerPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('отправляет структурированный запрос и показывает завершённый прогон', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: completedJob }),
    } as Response)
    const user = userEvent.setup()

    renderRunner()
    expect(screen.queryByLabelText('Токен оператора')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('HTTPS URL репозитория'), completedJob.repository_url)
    await user.type(screen.getByLabelText('ID команды'), completedJob.repository_id)
    await user.click(screen.getByRole('button', { name: 'Запустить оценку' }))

    expect(await screen.findByText('run-123')).toBeInTheDocument()
    expect(screen.getAllByText('Завершён').length).toBeGreaterThan(0)
    const [, options] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(options?.body))).toEqual({
      repository_url: completedJob.repository_url,
      repository_id: completedJob.repository_id,
      branch: 'main',
      area: 'both',
    })
    expect(options?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    })
  })

  it('показывает ошибку control plane', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'authorization required' } }),
    } as Response)
    const user = userEvent.setup()

    renderRunner()
    await user.type(screen.getByLabelText('HTTPS URL репозитория'), completedJob.repository_url)
    await user.type(screen.getByLabelText('ID команды'), completedJob.repository_id)
    await user.click(screen.getByRole('button', { name: 'Запустить оценку' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('authorization required')
  })
})
