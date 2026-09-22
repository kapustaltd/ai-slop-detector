import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AnchorScale } from './anchor-scale'

const anchors = {
  '2': 'Проверки прав нет.',
  '5': 'Проверки есть в части обработчиков.',
  '8': 'Правило выражено централизованно.',
  '10': 'Плюс тесты на отказ в доступе.',
}

describe('AnchorScale', () => {
  it('показывает все четыре якоря', () => {
    render(<AnchorScale anchors={anchors} score={4.0} rubricLabel="рубрика backend v1.4" />)

    expect(screen.getByText('Проверки прав нет.')).toBeInTheDocument()
    expect(screen.getByText('Плюс тесты на отказ в доступе.')).toBeInTheDocument()
  })

  it('вставляет отметку балла между соседними якорями', () => {
    render(<AnchorScale anchors={anchors} score={4.0} rubricLabel="рубрика backend v1.4" />)

    expect(screen.getByText('инструмент поставил 4.0')).toBeInTheDocument()
    expect(screen.getByText('между якорями 2 и 5, ближе к 5')).toBeInTheDocument()
  })

  it('не вставляет отметку, если балл точно совпадает с якорем', () => {
    render(<AnchorScale anchors={anchors} score={5} rubricLabel="рубрика backend v1.4" />)

    expect(screen.queryByText(/инструмент поставил/)).not.toBeInTheDocument()
  })
})
