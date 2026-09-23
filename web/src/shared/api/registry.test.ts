import { describe, expect, it } from 'vitest'

import { mergeRegistryTeams, type RegistryTeam } from './registry'
import type { LeaderboardIndexStub } from './bundle'

describe('mergeRegistryTeams', () => {
  it('shows registered teams without evaluations and keeps existing scores', () => {
    const index = {
      bundle_schema: '0.1',
      built_at: '2026-09-21T12:00:00Z',
      meta: {
        bundle_schema: '0.1',
        built_at: '2026-09-21T12:00:00Z',
        report_schema: '1.0',
        rubric_versions: [],
        skill_versions: [],
        models: [],
      },
      teams: [
        {
          team_id: 'existing',
          name: 'Old name',
          rank: 1,
          total: 8,
          areas: { backend: 8 },
          status: 'done',
          partial: false,
        },
      ],
    } as LeaderboardIndexStub
    const registered: RegistryTeam[] = [
      {
        id: 'existing',
        name: 'New name',
        repo: 'https://github.com/a/b',
        branch: 'main',
        active: true,
      },
      { id: 'new', name: 'New team', repo: 'https://github.com/a/c', branch: 'main', active: true },
    ]

    const merged = mergeRegistryTeams(index, registered)
    expect(merged.teams).toHaveLength(2)
    expect(merged.teams[0]).toMatchObject({ name: 'New name', total: 8, status: 'done' })
    expect(merged.teams[1]).toMatchObject({
      team_id: 'new',
      name: 'New team',
      rank: null,
      total: null,
      status: 'no_data',
    })
    expect(index.teams[0].name).toBe('Old name')
  })
})
