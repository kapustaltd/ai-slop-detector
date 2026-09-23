import { describe, expect, it, vi } from 'vitest'

import { BundleError, getLeaderboardIndex, loadLeaderboardIndex, loadTeam } from './bundle'

describe('доступ к дата-бандлу', () => {
  it('отдаёт индекс рейтинга из бандла', () => {
    const index = getLeaderboardIndex()
    expect(index.teams).toHaveLength(4)
  })

  it('загружает файл команды отдельным модулем', async () => {
    await expect(loadTeam('team-01')).resolves.toMatchObject({ team_id: 'team-01' })
  })

  it('сообщает об отсутствии команды в бандле', async () => {
    await expect(loadTeam('team-42')).rejects.toBeInstanceOf(BundleError)
  })

  it('асинхронный доступ к индексу отдаёт те же данные, что и синхронный', async () => {
    await expect(loadLeaderboardIndex()).resolves.toEqual(getLeaderboardIndex())
  })

  it('shows registry entries even before the server supports live bundles', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/bundle/index'
          ? new Response(null, { status: 404 })
          : new Response(
              JSON.stringify([
                {
                  id: 'new-team',
                  name: 'New team',
                  repo: 'https://github.com/example/new',
                  branch: 'main',
                  active: true,
                },
              ]),
              { status: 200 },
            ),
      ),
    )
    try {
      const index = await loadLeaderboardIndex()
      expect(index.teams).toMatchObject([{ team_id: 'new-team', status: 'no_data', total: null }])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back to the build-time bundle when the live API is unavailable', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await loadLeaderboardIndex()
      await loadTeam('team-01')
      expect(fetchSpy).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
