import { describe, expect, it, vi } from 'vitest'

import { BundleError, getLeaderboardIndex, loadLeaderboardIndex, loadTeam } from './bundle'

describe('доступ к дата-бандлу', () => {
  it('отдаёт индекс рейтинга из бандла', () => {
    const index = getLeaderboardIndex()
    expect(index.teams.length).toBeGreaterThan(0)
  })

  it('загружает файл команды отдельным модулем', async () => {
    const teamId = getLeaderboardIndex().teams[0]!.team_id
    await expect(loadTeam(teamId)).resolves.toMatchObject({ team_id: teamId })
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
      await loadTeam(getLeaderboardIndex().teams[0]!.team_id)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
