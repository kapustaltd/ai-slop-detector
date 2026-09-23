import { describe, expect, it } from 'vitest'

import { anchorPlacement, isLowConfidence, nodeContribution } from './contribution'

describe('nodeContribution', () => {
  it('перемножает вес и балл узла', () => {
    expect(nodeContribution(0.18, 8.6)).toBeCloseTo(1.548)
  })
})

describe('anchorPlacement', () => {
  it('находит сегмент и ближайший якорь для промежуточного балла', () => {
    expect(anchorPlacement(4.0)).toEqual({ lower: 2, upper: 5, closerTo: 5, exact: false })
    expect(anchorPlacement(3.0)).toEqual({ lower: 2, upper: 5, closerTo: 2, exact: false })
    expect(anchorPlacement(9.5)).toEqual({ lower: 8, upper: 10, closerTo: 10, exact: false })
  })

  it('не вставляет «между», если балл точно совпадает с якорем', () => {
    expect(anchorPlacement(5)).toEqual({ lower: 5, upper: 5, closerTo: 5, exact: true })
    expect(anchorPlacement(8)).toEqual({ lower: 8, upper: 8, closerTo: 8, exact: true })
  })

  it('прижимает края шкалы к первому/последнему якорю', () => {
    expect(anchorPlacement(0)).toEqual({ lower: 2, upper: 2, closerTo: 2, exact: true })
    expect(anchorPlacement(1)).toEqual({ lower: 2, upper: 2, closerTo: 2, exact: true })
    expect(anchorPlacement(10)).toEqual({ lower: 10, upper: 10, closerTo: 10, exact: true })
  })
})

describe('isLowConfidence', () => {
  it('true только для low', () => {
    expect(isLowConfidence('low')).toBe(true)
    expect(isLowConfidence('medium')).toBe(false)
    expect(isLowConfidence('high')).toBe(false)
  })
})
