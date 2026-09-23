import type { TeamArea } from '@/shared/api'

/** Подсчёт находок по типу и серьёзности во всех метриках области — перенос без изменения логики. */
export interface FindingCounts {
  strength: number
  issue: number
  info: number
  minor: number
  major: number
  critical: number
}

export function countFindings(area: TeamArea): FindingCounts {
  const result: FindingCounts = { strength: 0, issue: 0, info: 0, minor: 0, major: 0, critical: 0 }
  for (const category of area.categories) {
    for (const subcategory of category.subcategories) {
      for (const metric of subcategory.metrics) {
        for (const finding of metric.findings) {
          result[finding.kind] += 1
          result[finding.severity] += 1
        }
      }
    }
  }
  return result
}
