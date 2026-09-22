import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaxonomyRow } from './taxonomy-row'

describe('TaxonomyRow', () => {
  it('рендерит категорию (level 1) с весом, баллом и вкладом', () => {
    render(
      <TaxonomyRow
        level={1}
        name="Архитектура и структура"
        weight={0.18}
        weightLabel="вес 0.18"
        score={8.6}
        contribution={{ value: 1.55, ofTotal: 8.2, label: 'вклад в backend' }}
        trailing="5 находок"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('Архитектура и структура')).toBeInTheDocument()
    expect(screen.getByText('8.6')).toBeInTheDocument()
    expect(screen.getByText('5 находок')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('скрывает trailing, когда узел развёрнут', () => {
    render(
      <TaxonomyRow
        level={1}
        name="Безопасность"
        weight={0.13}
        weightLabel="вес 0.13"
        score={6.2}
        trailing="7 находок"
        expanded
        onToggle={vi.fn()}
      />,
    )

    expect(screen.queryByText('7 находок')).not.toBeInTheDocument()
  })

  it('показывает подпись id-слага только у развёрнутой метрики (level 3)', () => {
    render(
      <TaxonomyRow
        level={3}
        name="Проверка прав на уровне ресурса"
        idSlug="security.authz.resource-level"
        weight={0.4}
        weightLabel="вес 0.40 в подкатегории"
        weightContext="= 0.031 от backend"
        score={4.0}
        expanded
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByText('security.authz.resource-level')).toBeInTheDocument()
    expect(screen.getByText('= 0.031 от backend')).toBeInTheDocument()
  })

  it('показывает индикатор низкой уверенности только когда confidence low', () => {
    const { rerender } = render(
      <TaxonomyRow
        level={3}
        name="Метрика"
        weight={0.4}
        weightLabel="вес 0.40"
        score={4.0}
        confidence="low"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.getByText('уверенность низкая')).toBeInTheDocument()

    rerender(
      <TaxonomyRow
        level={3}
        name="Метрика"
        weight={0.4}
        weightLabel="вес 0.40"
        score={4.0}
        confidence="high"
        expanded={false}
        onToggle={vi.fn()}
      />,
    )
    expect(screen.queryByText('уверенность низкая')).not.toBeInTheDocument()
  })
})
