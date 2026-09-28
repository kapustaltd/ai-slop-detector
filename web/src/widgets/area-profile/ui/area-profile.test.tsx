import { fireEvent, render as renderComponent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import type { StatsBundle, TeamArea } from '@/shared/api'

import { AreaProfile } from './area-profile'

function render(ui: ReactElement) {
  return renderComponent(<MemoryRouter initialEntries={['/team/team-01']}>{ui}</MemoryRouter>)
}

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

  it('показывает базу сравнения и раскрывает расчёт отдельно (FR-002, FR-006, FR-020a)', () => {
    render(<AreaProfile areaName="backend" area={area()} stats={statsArea({})} />)

    expect(screen.getAllByText('Медиана').length).toBeGreaterThan(0)
    expect(screen.getByText('6,90')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Среднее' }))
    expect(screen.getByText('6,80')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Показать расчёт'))
    expect(screen.getByText('1.55')).toBeInTheDocument()
  })

  it('при недостатке данных скрывает сравнение, но оставляет оценки и профиль (FR-004)', () => {
    render(
      <AreaProfile
        areaName="backend"
        area={area()}
        stats={statsArea({ insufficient_data: true })}
      />,
    )

    expect(screen.getAllByText('Оценки по категориям').length).toBeGreaterThan(0)
    expect(
      screen.getByText('Сравнение появится, когда будут оценены минимум 2 команды.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Среднее' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Медиана' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Архитектура и структура').length).toBeGreaterThan(0)
  })
})
