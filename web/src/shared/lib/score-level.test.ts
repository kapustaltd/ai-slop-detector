import { describe, expect, it } from 'vitest'

import { scoreFillPercent, scoreLevel, scoreWord } from './score-level'

describe('шкала баллов', () => {
  it.each([
    [0, 1, 'низкий'],
    [2.9, 1, 'низкий'],
    [3, 2, 'ниже среднего'],
    [4.9, 2, 'ниже среднего'],
    [5, 3, 'средний'],
    [6.9, 3, 'средний'],
    [7, 4, 'выше среднего'],
    [8.4, 4, 'выше среднего'],
    [8.5, 5, 'высокий'],
    [10, 5, 'высокий'],
  ])('балл %s — ступень %s (%s)', (score, level, word) => {
    expect(scoreLevel(score)).toBe(level)
    expect(scoreWord(score)).toBe(word)
  })

  it('прижимает значения вне диапазона к границам', () => {
    expect(scoreLevel(-1)).toBe(1)
    expect(scoreLevel(11)).toBe(5)
    expect(scoreFillPercent(-1)).toBe(0)
    expect(scoreFillPercent(11)).toBe(100)
  })

  it('переводит балл в долю заполнения дорожки', () => {
    expect(scoreFillPercent(7.4)).toBeCloseTo(74)
  })
})
