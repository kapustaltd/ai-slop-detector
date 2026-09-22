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

  it('не обращается к сети: данные приходят импортом на сборке', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      await loadLeaderboardIndex()
      await loadTeam('team-01')
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
