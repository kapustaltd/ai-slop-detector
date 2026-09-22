/**
 * Ступени шкалы баллов. Источник — design/reference/tokens.json → scoreScale.
 *
 * Пять ступеней одного тона по светлоте. Цвет никогда не единственный носитель
 * смысла: рядом обязательны число, длина дорожки и слово, поэтому уровень отдаёт
 * и то и другое.
 */

export type ScoreLevel = 1 | 2 | 3 | 4 | 5

export const SCORE_MAX = 10

const LEVELS: ReadonlyArray<{ level: ScoreLevel; upTo: number; word: string }> = [
  { level: 1, upTo: 2.9, word: 'низкий' },
  { level: 2, upTo: 4.9, word: 'ниже среднего' },
  { level: 3, upTo: 6.9, word: 'средний' },
  { level: 4, upTo: 8.4, word: 'выше среднего' },
  { level: 5, upTo: SCORE_MAX, word: 'высокий' },
]

/** Ступень шкалы для балла. Значения вне 0–10 прижимаются к границам. */
export function scoreLevel(score: number): ScoreLevel {
  const clamped = Math.min(Math.max(score, 0), SCORE_MAX)
  return (LEVELS.find((step) => clamped <= step.upTo) ?? LEVELS[LEVELS.length - 1]).level
}

/** Словесная ступень: второй носитель смысла рядом с цветом. */
export function scoreWord(score: number): string {
  const level = scoreLevel(score)
  return LEVELS[level - 1].word
}

/** Доля заполнения дорожки в процентах. */
export function scoreFillPercent(score: number): number {
  return (Math.min(Math.max(score, 0), SCORE_MAX) / SCORE_MAX) * 100
}
