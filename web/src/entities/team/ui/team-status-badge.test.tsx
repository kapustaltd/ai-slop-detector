import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TeamStatusBadge } from './team-status-badge'

describe('TeamStatusBadge', () => {
  it('показывает подпись и доступное пояснение для каждого статуса', () => {
    render(<TeamStatusBadge status="done" />)
    expect(screen.getByText('Оценка готова')).toBeInTheDocument()
    expect(screen.getByText('Результат автоматической проверки готов.')).toBeInTheDocument()
  })

  it('для failed поясняет, что нужен повторный запуск', () => {
    render(<TeamStatusBadge status="failed" />)
    expect(screen.getByText('Проверка прервана')).toBeInTheDocument()
    expect(
      screen.getByText('Проверка прервана. Повторный запуск доступен оператору.'),
    ).toBeInTheDocument()
  })

  it('для no_data не намекает на нулевой балл', () => {
    render(<TeamStatusBadge status="no_data" />)
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
    expect(screen.getByText('Данных нет — оценка ещё не проводилась.')).toBeInTheDocument()
  })

  it('для running показывает статус выполнения', () => {
    render(<TeamStatusBadge status="running" />)
    expect(screen.getByText('Проверяется')).toBeInTheDocument()
  })

  it('частичную оценку показывает как «Частично», а не «Оценено»', () => {
    render(<TeamStatusBadge status="done" partial />)
    expect(screen.getByText('Частично')).toBeInTheDocument()
    expect(screen.queryByText('Оценка готова')).not.toBeInTheDocument()
  })
})
