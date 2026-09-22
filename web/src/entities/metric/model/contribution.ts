/**
 * Позиция балла среди якорей 2/5/8/10. Не координата на непрерывной шкале — макет
 * (`06-metric-drilldown.html`) вставляет строку «инструмент поставил N» СПИСКОМ между карточками
 * соседних якорей, а не двигает маркер по дорожке: `anchorPlacement` возвращает, между какими
 * двумя якорями лежит балл и к какому из них он ближе (для подсветки нужной карточки и текста
 * «между якорями 2 и 5, ближе к 5»).
 */

/**
 * «Вклад в родителя» (FR-020a) — простое произведение веса на собственный балл узла, для
 * отображения рядом с весом (`TaxonomyRow`, текстовая таблица `AreaProfile`). Не взвешенная сумма
 * по области и не агрегат нескольких узлов — тех величин в контракте нет как отдельного поля,
 * пересчитывать их UI не должен (принцип VI); произведение веса и уже готового балла узла —
 * не такая величина.
 */
export function nodeContribution(weight: number, score: number): number {
  return weight * score
}

export type AnchorLevel = 2 | 5 | 8 | 10

export interface AnchorPlacement {
  lower: AnchorLevel
  upper: AnchorLevel
  closerTo: AnchorLevel
  /** Балл точно совпадает с якорем — «между» не вставляется, подсвечивается один якорь. */
  exact: boolean
}

const ANCHOR_LEVELS: AnchorLevel[] = [2, 5, 8, 10]

export function anchorPlacement(score: number): AnchorPlacement {
  const clamped = Math.min(Math.max(score, 0), 10)

  if (clamped <= ANCHOR_LEVELS[0]) {
    return { lower: 2, upper: 2, closerTo: 2, exact: true }
  }
  if (clamped >= ANCHOR_LEVELS[ANCHOR_LEVELS.length - 1]) {
    return { lower: 10, upper: 10, closerTo: 10, exact: true }
  }

  for (let i = 0; i < ANCHOR_LEVELS.length - 1; i += 1) {
    const lower = ANCHOR_LEVELS[i]
    const upper = ANCHOR_LEVELS[i + 1]
    if (clamped > lower && clamped < upper) {
      const mid = (lower + upper) / 2
      return { lower, upper, closerTo: clamped <= mid ? lower : upper, exact: false }
    }
    if (clamped === lower) {
      return { lower, upper: lower, closerTo: lower, exact: true }
    }
  }
  return { lower: 10, upper: 10, closerTo: 10, exact: true }
}

/**
 * Низкая уверенность не приглушает и не перечёркивает балл (DESIGN.md) — несёт её отдельный
 * элемент: пунктирная рамка и индикатор из трёх точек, определяемые этим флагом.
 */
export function isLowConfidence(confidence: 'high' | 'medium' | 'low'): boolean {
  return confidence === 'low'
}
