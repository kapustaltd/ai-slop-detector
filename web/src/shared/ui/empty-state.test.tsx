import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchX } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('показывает заголовок и описание', () => {
    render(
      <EmptyState
        icon={SearchX}
        title="Оценок пока нет"
        description="Конвейер ещё не отработал."
      />,
    )

    expect(screen.getByText('Оценок пока нет')).toBeInTheDocument()
    expect(screen.getByText('Конвейер ещё не отработал.')).toBeInTheDocument()
  })

  it('не рисует действие, если его не передали', () => {
    render(<EmptyState icon={SearchX} title="Оценок пока нет" description="Описание" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('вызывает действие по клику, когда оно передано', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <EmptyState
        icon={SearchX}
        title="Под фильтры не попала ни одна команда"
        description="Сбросьте фильтры"
        action={{ label: 'Сбросить фильтры', onClick }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
