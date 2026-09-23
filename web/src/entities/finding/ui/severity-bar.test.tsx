import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SeverityBar } from './severity-bar'

const counts = { critical: 1, major: 5, minor: 11, info: 6 }

describe('SeverityBar', () => {
  it('показывает счётчик на каждую серьёзность', () => {
    render(<SeverityBar counts={counts} activeSeverity="all" onSelect={vi.fn()} />)

    expect(screen.getByText('критические')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /критические/ })).toBeInTheDocument()
  })

  it('клик по сегменту вызывает onSelect с нужной серьёзностью', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SeverityBar counts={counts} activeSeverity="all" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /серьёзные/ }))
    expect(onSelect).toHaveBeenCalledWith('major')
  })

  it('повторный клик по активному сегменту снимает фильтр', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SeverityBar counts={counts} activeSeverity="major" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /серьёзные/ }))
    expect(onSelect).toHaveBeenCalledWith('all')
  })

  it('не рисует сегмент нулевой серьёзности', () => {
    render(
      <SeverityBar
        counts={{ critical: 0, major: 2, minor: 0, info: 1 }}
        activeSeverity="all"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /критические/ })).not.toBeInTheDocument()
  })
})
