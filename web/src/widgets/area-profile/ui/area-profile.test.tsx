import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { StatsBundle, TeamArea } from '@/shared/api'

import { AreaProfile } from './area-profile'

function area(): TeamArea {
  return {
    status: 'done',
    score: 8.2,
    max: 10,
    categories: [
      {
        id: 'architecture',
        name: 'Архитектура и структура',
        weight: 0.18,
        score: 8.6,
        subcategories: [
          {
            id: 'sub',
            name: 'sub',
            weight: 1,
            score: 8.6,
            metrics: [
              {
                id: 'm1',
                name: 'm1',
                weight: 1,
                score: 8.6,
                max: 10,
                confidence: 'high',
                summary: 's',
                rationale: 'r',
                findings: [
                  {
                    kind: 'strength',
                    severity: 'info',
                    file: 'a.ts',
                    line_start: 1,
                    line_end: 2,
                    title: 't',
                    explanation: 'e',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function statsArea(overrides: Partial<StatsBundle['areas'][number]>): StatsBundle['areas'][number] {
  return {
    area: 'backend',
    sample_size: 5,
    insufficient_data: false,
    categories: [{ id: 'architecture', mean: 6.8, median: 6.9, count: 5 }],
    metrics: [],
    ...overrides,
  }
}

describe('AreaProfile', () => {
  it('показывает категории в таблице-альтернативе — не по метрикам (FR-003)', () => {
    render(<AreaProfile areaName="backend" area={area()} stats={statsArea({})} />)

    expect(screen.getAllByText('Архитектура и структура').length).toBeGreaterThan(0)
    expect(screen.queryByText('m1')).not.toBeInTheDocument()
  })

  it('таблица содержит медиану, среднее и вклад (FR-002, FR-006, FR-020a)', () => {
    render(<AreaProfile areaName="backend" area={area()} stats={statsArea({})} />)

    expect(screen.getByText('Медиана')).toBeInTheDocument()
    expect(screen.getByText('6.9')).toBeInTheDocument()
    expect(screen.getByText('6.8')).toBeInTheDocument()
    expect(screen.getByText('1.55')).toBeInTheDocument()
  })

  it('при недостатке данных сравнение не рисуется, но профиль остаётся (FR-004)', () => {
    render(
      <AreaProfile
        areaName="backend"
        area={area()}
        stats={statsArea({ insufficient_data: true })}
      />,
    )

    expect(screen.getByText(/Недостаточно оценённых команд/)).toBeInTheDocument()
    expect(screen.getAllByText('Архитектура и структура').length).toBeGreaterThan(0)
  })
})
