import type { TeamBundle } from '@/shared/api'

/** Счётчик метрик с низкой уверенностью по всей команде — тальи, не пересчёт баллов (принцип VI). */
export function countLowConfidenceMetrics(team: TeamBundle): number {
  let count = 0
  for (const area of Object.values(team.areas)) {
    for (const category of area.categories) {
      for (const subcategory of category.subcategories) {
        for (const metric of subcategory.metrics) {
          if (metric.confidence === 'low') count += 1
        }
      }
    }
  }
  return count
}
