import { nodeContribution } from '@/entities/metric'
import type { StatsBundle, TeamArea } from '@/shared/api'

/** Строка данных графика/таблицы-альтернативы — одна на категорию области. */
export interface CategoryChartPoint {
  id: string
  name: string
  score: number
  weight: number
  median?: number
  mean?: number
  contribution: number
  findingsCount: number
}

function countFindings(category: TeamArea['categories'][number]): number {
  let count = 0
  for (const subcategory of category.subcategories) {
    for (const metric of subcategory.metrics) {
      count += metric.findings.length
    }
  }
  return count
}

export function areaChartData(
  area: TeamArea,
  stats: StatsBundle['areas'][number] | undefined,
): CategoryChartPoint[] {
  return area.categories.map((category) => {
    const comparison = stats?.categories.find((item) => item.id === category.id)
    return {
      id: category.id,
      name: category.name,
      score: category.score,
      weight: category.weight,
      median: stats && !stats.insufficient_data ? comparison?.median : undefined,
      mean: stats && !stats.insufficient_data ? comparison?.mean : undefined,
      contribution: nodeContribution(category.weight, category.score),
      findingsCount: countFindings(category),
    }
  })
}
