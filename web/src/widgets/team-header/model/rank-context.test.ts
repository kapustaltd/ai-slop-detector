import { describe, expect, it } from 'vitest'

import { teamRankContext } from './rank-context'

describe('teamRankContext', () => {
  it('находит команду в индексе и её соседей', () => {
    const context = teamRankContext('team-01')

    expect(context.rank).not.toBeNull()
    expect(context.totalTeams).toBeGreaterThan(0)
  })

  it('возвращает пустой контекст для команды не из индекса, не бросает исключение', () => {
    const context = teamRankContext('team-does-not-exist')

    expect(context).toEqual({
      rank: null,
      totalTeams: 0,
      tiedWith: [],
      previousTeamId: null,
      nextTeamId: null,
    })
  })
})
