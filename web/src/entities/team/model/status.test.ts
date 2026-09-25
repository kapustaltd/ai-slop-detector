import { describe, expect, it } from 'vitest'

import type { LeaderboardTeam } from '@/shared/api'

import { normalizeStatus, sortTeams, statusLabel, warningLabel } from './status'

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

describe('statusLabel', () => {
  it('возвращает подпись на каждый статус', () => {
    expect(statusLabel('done')).toBe('Готово')
    expect(statusLabel('failed')).toBe('Ошибка')
    expect(statusLabel('no_data')).toBe('В очереди')
    expect(statusLabel('running')).toBe('Проверяется')
    expect(statusLabel('partial')).toBe('Частично')
  })
})

describe('normalizeStatus', () => {
  it('пропускает известные значения как есть', () => {
    expect(normalizeStatus('failed')).toBe('failed')
  })

  it('приводит неизвестное значение к no_data', () => {
    expect(normalizeStatus('archived')).toBe('no_data')
  })
})

describe('warningLabel', () => {
  it('переводит известные значения warnings[]', () => {
    expect(warningLabel('suspected_prompt_injection')).toBe('Влияние на оценку')
    expect(warningLabel('repo_too_large')).toBe('Лимит размера')
    expect(warningLabel('file_limit_exceeded')).toBe('Лимит размера')
    expect(warningLabel('secret_redacted')).toBe('Секрет скрыт')
    expect(warningLabel('incomplete_area')).toBe('Область оценена частично')
    expect(warningLabel('provider_error')).toBe('Ошибка модели')
  })

  it('не падает на неизвестном значении', () => {
    expect(warningLabel('future_warning_kind')).toBe('Предупреждение оценки')
  })
})

describe('sortTeams', () => {
  it('держит команды без значения в хвосте независимо от направления', () => {
    const teams = [
      team({ team_id: 'b', total: 5 }),
      team({ team_id: 'a', total: null, rank: null }),
      team({ team_id: 'c', total: 8 }),
    ]

    const desc = sortTeams(teams, 'total', 'desc').map((t) => t.team_id)
    const asc = sortTeams(teams, 'total', 'asc').map((t) => t.team_id)

    expect(desc).toEqual(['c', 'b', 'a'])
    expect(asc).toEqual(['b', 'c', 'a'])
  })

  it('детерминированно упорядочивает равные значения по team_id', () => {
    const teams = [team({ team_id: 'zeta', total: 7 }), team({ team_id: 'alpha', total: 7 })]

    expect(sortTeams(teams, 'total', 'desc').map((t) => t.team_id)).toEqual(['alpha', 'zeta'])
  })

  it('сортирует по колонке области', () => {
    const teams = [
      team({ team_id: 'a', areas: { backend: 4 } }),
      team({ team_id: 'b', areas: { backend: 9 } }),
    ]

    expect(sortTeams(teams, 'backend', 'desc').map((t) => t.team_id)).toEqual(['b', 'a'])
  })
})
