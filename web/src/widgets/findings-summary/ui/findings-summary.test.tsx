import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FindingsSummary } from './findings-summary'

const counts = { strength: 14, issue: 23, critical: 1, major: 5, minor: 11, info: 6 }

describe('FindingsSummary', () => {
  it('показывает счётчики strength/issue', () => {
    render(<FindingsSummary counts={counts} activeSeverity="all" onSeverityChange={vi.fn()} />)

    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('сильных сторон')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('проблемы')).toBeInTheDocument()
  })

  it('клик по сегменту SeverityBar вызывает onSeverityChange', async () => {
    const onSeverityChange = vi.fn()
    const user = userEvent.setup()
    render(
      <FindingsSummary counts={counts} activeSeverity="all" onSeverityChange={onSeverityChange} />,
    )

    await user.click(screen.getByRole('button', { name: /критические/ }))
    expect(onSeverityChange).toHaveBeenCalledWith('critical')
  })
})
