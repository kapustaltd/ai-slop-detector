import { describe, expect, it } from 'vitest'

import { BundleError, getLeaderboardIndex, loadTeam } from './bundle'

describe('доступ к дата-бандлу', () => {
  it('отдаёт индекс рейтинга из бандла', () => {
    const index = getLeaderboardIndex()
    expect(index.teams).toHaveLength(3)
  })

  it('загружает файл команды отдельным модулем', async () => {
    await expect(loadTeam('team-01')).resolves.toMatchObject({ team_id: 'team-01' })
  })

  it('сообщает об отсутствии команды в бандле', async () => {
    await expect(loadTeam('team-42')).rejects.toBeInstanceOf(BundleError)
  })
})
