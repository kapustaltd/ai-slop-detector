/**
 * Форматирует балл для показа. Приложение не вычисляет баллы (принцип VI конституции),
 * только приводит уже готовое число к единому виду.
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—'
  return score.toFixed(1)
}
