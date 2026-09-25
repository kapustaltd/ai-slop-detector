import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RegistryEvaluationProgress } from '@/shared/api'
import { AgentActivity } from './agent-activity'

const initial: RegistryEvaluationProgress = {
  status: 'running',
  stage: 'analyzing',
  areas: [],
  events: [
    {
      sequence: 1,
      at: '2026-09-24T10:00:00Z',
      kind: 'tool',
      title: 'Read',
      detail: 'src/main.go',
      area: 'backend',
      tool_id: 't1',
      state: 'running',
    },
  ],
}

describe('AgentActivity', () => {
  it('updates a tool in place and renders incoming criterion explanations', () => {
    const { rerender } = render(<AgentActivity progress={initial} />)
    expect(screen.getByText('Выполняется')).toBeInTheDocument()
    rerender(
      <AgentActivity
        progress={{
          ...initial,
          events: [
            { ...initial.events[0], state: 'done' },
            {
              sequence: 2,
              at: '2026-09-24T10:00:01Z',
              kind: 'reasoning',
              title: 'Ошибки API',
              detail: 'Проверяю обработчик тайм-аутов.',
              area: 'backend',
              category_id: 'B1',
            },
          ],
        }}
      />,
    )
    expect(screen.queryByText('Выполняется')).not.toBeInTheDocument()
    expect(screen.getByText('Завершено')).toBeInTheDocument()
    expect(screen.getAllByText('src/main.go')).toHaveLength(1)
    expect(screen.getByText('Проверяю обработчик тайм-аутов.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Frontend' }))
    expect(screen.queryByText('src/main.go')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Все' }))
    expect(screen.getByText('src/main.go')).toBeInTheDocument()
  })

  it('does not imply an unfinished tool succeeded when evaluation fails', () => {
    render(<AgentActivity progress={{ ...initial, status: 'failed' }} />)
    expect(screen.getByText('Завершение инструмента не подтверждено.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Завершено')).not.toBeInTheDocument()
  })
})
