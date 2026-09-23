import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScoreGauge } from './score-gauge'

describe('ScoreGauge', () => {
  it('показывает число, максимум и словесную ступень', () => {
    render(<ScoreGauge value={6.2} />)

    expect(screen.getByText('6.2')).toBeInTheDocument()
    expect(screen.getByText('/ 10')).toBeInTheDocument()
    expect(screen.getByText('средний')).toBeInTheDocument()
  })

  it('оставляет слово доступным скринридеру, когда оно скрыто визуально', () => {
    const { container } = render(<ScoreGauge value={8.6} showWord={false} />)

    const hidden = container.querySelector('.sr-only')
    expect(hidden).toHaveTextContent('высокий')
  })

  it('рисует прочерк вместо нуля, когда оценки нет', () => {
    render(<ScoreGauge value={null} />)

    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
    expect(screen.getByText('оценки нет')).toBeInTheDocument()
  })

  it('заполняет дорожку пропорционально баллу', () => {
    const { container } = render(<ScoreGauge value={7.4} />)

    const fill = container.querySelector('[aria-hidden="true"] > span')
    expect(fill).toHaveStyle({ width: '74%' })
  })

  it('различает ступени шкалы цветом дорожки', () => {
    const { container: low } = render(<ScoreGauge value={2.0} />)
    const { container: high } = render(<ScoreGauge value={9.5} />)

    const lowFill = low.querySelector('[aria-hidden="true"] > span')
    const highFill = high.querySelector('[aria-hidden="true"] > span')
    expect(lowFill).toHaveStyle({ background: 'var(--ds-score-1)' })
    expect(highFill).toHaveStyle({ background: 'var(--ds-score-5)' })
  })

  it('layout stacked растягивает дорожку на всю ширину, а не на trackWidth', () => {
    const { container } = render(<ScoreGauge value={7.2} layout="stacked" trackWidth={264} />)

    const track = container.querySelector('[aria-hidden="true"]')
    expect(track).toHaveStyle({ width: '100%' })
  })
})
