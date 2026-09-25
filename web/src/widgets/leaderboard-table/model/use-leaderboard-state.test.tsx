import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { LeaderboardIndexStub, LeaderboardTeam } from '@/shared/api'

import { useLeaderboardState } from './use-leaderboard-state'

function team(overrides: Partial<LeaderboardTeam>): LeaderboardTeam {
  return {
    team_id: 'team-x',
    name: 'Команда X',
    rank: 1,
    total: 5,
    areas: {},
    status: 'done',
    partial: false,
    ...overrides,
  }
}

function index(teams: LeaderboardTeam[]): LeaderboardIndexStub {
  return {
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
    teams,
  }
}

function wrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  }
}

describe('useLeaderboardState', () => {
  it('по умолчанию сортирует по rank без параметров в адресе', () => {
    const teams = [
      team({ team_id: 'a', rank: 2, total: 5 }),
      team({ team_id: 'b', rank: 1, total: 8 }),
    ]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/']),
    })

    expect(result.current.sort).toEqual({ key: 'rank', direction: 'asc' })
    expect(result.current.teams.map((t) => t.team_id)).toEqual(['b', 'a'])
  })

  it('неизвестное значение параметра трактуется как значение по умолчанию', () => {
    const teams = [team({ team_id: 'a' })]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/?sort=bogus&status=archived']),
    })

    expect(result.current.sort.key).toBe('rank')
    expect(result.current.filters.status).toBe('all')
  })

  it('переключает направление сортировки при повторном вызове onSort той же колонки', () => {
    const teams = [team({ team_id: 'a' })]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/?sort=total&dir=desc']),
    })

    act(() => result.current.onSort('total'))
    expect(result.current.sort).toEqual({ key: 'total', direction: 'asc' })
  })

  it('комбинирует фильтр по статусу и по предупреждениям', () => {
    const teams = [
      team({ team_id: 'a', status: 'done', warnings: ['secret_redacted'] }),
      team({ team_id: 'b', status: 'done', warnings: [] }),
      team({ team_id: 'c', status: 'failed', warnings: ['secret_redacted'] }),
    ]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/?status=done&warnings=1']),
    })

    expect(result.current.teams.map((t) => t.team_id)).toEqual(['a'])
    expect(result.current.total).toBe(3)
  })

  it('фильтрует команды по поисковому запросу без учёта регистра', () => {
    const teams = [
      team({ team_id: 'alpha', name: 'Альфа' }),
      team({ team_id: 'beta', name: 'Бета' }),
    ]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/?q=АЛЬФА']),
    })

    expect(result.current.teams.map((t) => t.team_id)).toEqual(['alpha'])
  })

  it('фильтрует частичные оценки как отдельный статус', () => {
    const teams = [
      team({ team_id: 'full', status: 'done', partial: false }),
      team({ team_id: 'partial', status: 'done', partial: true }),
    ]
    const { result } = renderHook(() => useLeaderboardState(index(teams)), {
      wrapper: wrapper(['/?status=partial']),
    })

    expect(result.current.teams.map((t) => t.team_id)).toEqual(['partial'])
  })
})
