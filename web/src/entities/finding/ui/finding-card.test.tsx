import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FindingView } from '@/shared/api'

import { FindingCard } from './finding-card'

function finding(overrides: Partial<FindingView>): FindingView {
  return {
    kind: 'issue',
    severity: 'major',
    file: 'src/orders/orders.controller.ts',
    line_start: 41,
    line_end: 51,
    title: 'Заказ возвращается без проверки владельца',
    explanation: 'Объяснение находки.',
    ...overrides,
  }
}

describe('FindingCard — verified', () => {
  it('показывает кнопку перехода на постоянную ссылку', () => {
    render(
      <FindingCard
        finding={finding({ permalink: 'https://x', link_status: 'verified' })}
        density="expanded"
        permalinkBase="a91b73e"
      />,
    )

    expect(screen.getByRole('link', { name: /Открыть на a91b73e/ })).toHaveAttribute(
      'href',
      'https://x',
    )
  })
})

describe('FindingCard — unverified', () => {
  it('не показывает сниппет и помечает ссылку как непроверенную', () => {
    render(
      <FindingCard
        finding={finding({
          permalink: 'https://x',
          link_status: 'missing_file',
          snippet: 'const x = 1',
        })}
        density="expanded"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText(/Ссылку не удалось проверить/)).toBeInTheDocument()
    expect(screen.queryByText('const x = 1')).not.toBeInTheDocument()
  })

  it('summary — помечает непроверенную ссылку короткой пометкой', () => {
    render(
      <FindingCard
        finding={finding({ permalink: 'https://x', link_status: 'unverified' })}
        density="summary"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('ссылку не удалось проверить')).toBeInTheDocument()
  })
})

describe('FindingCard — no-permalink', () => {
  it('показывает сниппет без кнопки перехода', () => {
    render(
      <FindingCard
        finding={finding({ permalink: undefined, snippet: 'return order;' })}
        density="expanded"
      />,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText(/return order/)).toBeInTheDocument()
  })
})

describe('FindingCard — плотность и рекомендация', () => {
  it('summary — компактная строка, без кода и объяснения', () => {
    render(
      <FindingCard
        finding={finding({ explanation: 'Развёрнутое объяснение.' })}
        density="summary"
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('Заказ возвращается без проверки владельца')).toBeInTheDocument()
    expect(screen.queryByText('Развёрнутое объяснение.')).not.toBeInTheDocument()
  })

  it('рекомендация видна только у issue с suggestion', () => {
    render(
      <FindingCard
        finding={finding({ kind: 'issue', suggestion: 'Вынести проверку в guard.' })}
        density="expanded"
      />,
    )
    expect(screen.getByText('Вынести проверку в guard.')).toBeInTheDocument()
  })

  it('рекомендация отсутствует у strength', () => {
    render(
      <FindingCard
        finding={finding({ kind: 'strength', suggestion: undefined })}
        density="expanded"
      />,
    )
    expect(screen.queryByText('Рекомендация')).not.toBeInTheDocument()
  })
})
