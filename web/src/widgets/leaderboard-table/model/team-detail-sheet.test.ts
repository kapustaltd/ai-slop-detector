import { describe, expect, it } from 'vitest'

import type { LeaderboardTeam, TeamBundle } from '@/shared/api'

import {
  findingHref,
  getDetailInsights,
  getDetailNotes,
  getSeverityCounts,
  getTeamFindings,
} from './team-detail-sheet'

const summary: LeaderboardTeam = {
  team_id: 'team-partial',
  name: 'Команда с ограничениями',
  rank: null,
  total: 6.8,
  areas: { frontend: 6.8 },
  status: 'done',
  partial: true,
  warnings: ['repo_too_large', 'secret_redacted'],
}

const team = {
  bundle_schema: '0.1',
  built_at: '2026-09-28T10:00:00Z',
  team_id: 'team-partial',
  name: 'Команда с ограничениями',
  status: 'done',
  total: 6.8,
  partial: true,
  warnings: ['repo_too_large', 'secret_redacted'],
  areas: {
    frontend: {
      status: 'done',
      score: 6.8,
      max: 10,
      categories: [
        {
          id: 'architecture',
          name: 'Архитектура',
          weight: 1,
          score: 6.8,
          subcategories: [
            {
              id: 'components',
              name: 'Компоненты',
              weight: 1,
              score: 6.8,
              metrics: [
                {
                  id: 'decomposition',
                  name: 'Декомпозиция компонентов',
                  weight: 1,
                  score: 6.8,
                  max: 10,
                  confidence: 'high',
                  summary: 'Частично выполнено',
                  rationale: 'Проверено по коду',
                  findings: [
                    {
                      kind: 'strength',
                      severity: 'info',
                      file: 'src/App.tsx',
                      line_start: 1,
                      line_end: 2,
                      title: 'Есть базовое разделение',
                      explanation: 'Компоненты вынесены в отдельные файлы.',
                      permalink: 'https://example.test/blob/sha/src/App.tsx#L1-L2',
                      link_status: 'verified',
                    },
                    {
                      kind: 'issue',
                      severity: 'major',
                      file: 'src/App.tsx',
                      line_start: 3,
                      line_end: 4,
                      title: 'Слишком крупный компонент',
                      explanation: 'renderApp содержит несколько независимых зон.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
} as TeamBundle

describe('team detail sheet model', () => {
  it('разделяет сильную сторону и приоритетную проблему', () => {
    const findings = getTeamFindings(team)
    const insights = getDetailInsights(findings)

    expect(insights.map((insight) => insight.label)).toEqual([
      'Сильная сторона',
      'Приоритетная проблема',
    ])
    expect(getSeverityCounts(findings)).toEqual({ critical: 0, major: 1, minor: 0, info: 1 })
  })

  it('описывает ограничение покрытия и маскировку значения без утверждения о найденном секрете', () => {
    const notes = getDetailNotes(summary, team)

    expect(notes.map((note) => note.title)).toEqual([
      'Backend не оценена',
      'Лимит размера',
      'Значение секрета скрыто',
    ])
    expect(notes[2]?.description).not.toContain('найден')
  })

  it('строит ссылку на раскрытую метрику полного отчёта', () => {
    const context = getTeamFindings(team)[0]

    expect(findingHref(summary.team_id, context)).toBe(
      '/team/team-partial?area=frontend&node=architecture.components.decomposition&finding=src%2FApp.tsx%3A1-2',
    )
  })
})
