import { afterEach, describe, expect, it, vi } from 'vitest'

import { BundleError, getLeaderboardIndex, loadLeaderboardIndex, loadTeam } from './bundle'

describe('доступ к дата-бандлу', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('отдаёт индекс рейтинга из бандла', () => {
    const index = getLeaderboardIndex()
    expect(index.teams).toHaveLength(4)
  })

  it('загружает файл команды отдельным модулем', async () => {
    await expect(loadTeam('team-01')).resolves.toMatchObject({ team_id: 'team-01' })
  })

  it('сообщает об отсутствии команды в бандле', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(loadTeam('team-42')).rejects.toBeInstanceOf(BundleError)
  })

  it('предпочитает свежий индекс web runner', async () => {
    const live = { ...getLeaderboardIndex(), teams: [] }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => live } as Response),
    )
    await expect(loadLeaderboardIndex()).resolves.toEqual(live)
  })
})
