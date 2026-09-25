import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TeamStatusBadge } from './team-status-badge'

describe('TeamStatusBadge', () => {
  it('показывает подпись и доступное пояснение для каждого статуса', () => {
    render(<TeamStatusBadge status="done" />)
    expect(screen.getByText('Готово')).toBeInTheDocument()
    expect(screen.getByText('Результат автоматической проверки готов.')).toBeInTheDocument()
  })

  it('для failed поясняет, что нужен повторный запуск', () => {
    render(<TeamStatusBadge status="failed" />)
    expect(screen.getByText('Ошибка')).toBeInTheDocument()
    expect(
      screen.getByText('Проверка завершилась с ошибкой. Повторный запуск доступен оператору.'),
    ).toBeInTheDocument()
  })

  it('для no_data не намекает на нулевой балл', () => {
    render(<TeamStatusBadge status="no_data" />)
    expect(screen.getByText('В очереди')).toBeInTheDocument()
    expect(screen.getByText('Команда ожидает проверки.')).toBeInTheDocument()
  })

  it('для running показывает статус выполнения', () => {
    render(<TeamStatusBadge status="running" />)
    expect(screen.getByText('Проверяется')).toBeInTheDocument()
  })

  it('частичную оценку показывает как «Частично», а не «Оценено»', () => {
    render(<TeamStatusBadge status="done" partial />)
    expect(screen.getByText('Частично')).toBeInTheDocument()
    expect(screen.queryByText('Готово')).not.toBeInTheDocument()
  })
})
