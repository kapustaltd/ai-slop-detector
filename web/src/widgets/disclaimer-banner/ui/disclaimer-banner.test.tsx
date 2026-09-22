import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DisclaimerBanner } from './disclaimer-banner'

describe('DisclaimerBanner', () => {
  it('показывает фиксированный текст рамки', () => {
    render(<DisclaimerBanner />)
    expect(screen.getByText('Это вспомогательная метрика, а не вердикт')).toBeInTheDocument()
  })

  it('не показывает ссылку, если href не передан', () => {
    render(<DisclaimerBanner />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('показывает ссылку на рубрику, если href передан', () => {
    render(<DisclaimerBanner rubricHref="#rubric" />)
    expect(screen.getByRole('link', { name: /Как считается оценка/ })).toHaveAttribute(
      'href',
      '#rubric',
    )
  })
})
