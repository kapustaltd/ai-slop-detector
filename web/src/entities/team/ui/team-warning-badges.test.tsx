import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TeamWarningBadges } from './team-warning-badges'

describe('TeamWarningBadges', () => {
  it('не рендерит ничего без предупреждений', () => {
    const { container } = render(<TeamWarningBadges warnings={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('переводит известное значение warnings[] в подпись', () => {
    render(<TeamWarningBadges warnings={['suspected_prompt_injection']} />)
    expect(screen.getByText('Влияние на оценку')).toBeInTheDocument()
  })

  it('не падает на неизвестном значении warnings[]', () => {
    render(<TeamWarningBadges warnings={['future_warning_kind']} />)
    expect(screen.getByText('Предупреждение оценки')).toBeInTheDocument()
  })

  it('рендерит бейдж на каждое предупреждение', () => {
    render(<TeamWarningBadges warnings={['repo_too_large', 'secret_redacted']} />)
    expect(screen.getByText('Лимит размера')).toBeInTheDocument()
    expect(screen.getByText('Секрет скрыт')).toBeInTheDocument()
  })

  it('в компактном режиме сворачивает предупреждения в счётчик', () => {
    render(<TeamWarningBadges warnings={['repo_too_large', 'secret_redacted']} compact />)

    expect(screen.getByText('2 предупреждения')).toBeInTheDocument()
    expect(screen.queryByText('Лимит размера')).not.toBeVisible()
  })
})
