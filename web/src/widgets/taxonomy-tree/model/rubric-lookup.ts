import type { RubricBundle, RubricMetric } from '@/shared/api'

/** Индекс метрик рубрики по id — метрика ищется независимо от того, в какой категории лежит. */
export function rubricMetricMap(rubric: RubricBundle | undefined): Map<string, RubricMetric> {
  const map = new Map<string, RubricMetric>()
  for (const category of rubric?.categories ?? []) {
    for (const subcategory of category.subcategories) {
      for (const metric of subcategory.metrics) {
        map.set(metric.id, metric)
      }
    }
  }
  return map
}
