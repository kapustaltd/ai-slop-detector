import { statusLabel } from '@/entities/team'
import type { SortKey } from '@/entities/team'
import type { EvaluationStatus } from '@/shared/api'

/** Конфигурация колонок и опций фильтра/сортировки — данные, а не разметка. */

export const SORT_COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'rank', label: 'Место' },
  { key: 'total', label: 'Итог', align: 'right' },
  { key: 'backend', label: 'Backend', align: 'right' },
  { key: 'frontend', label: 'Frontend', align: 'right' },
]

const FILTERABLE_STATUSES: EvaluationStatus[] = ['done', 'failed', 'no_data', 'running']

export const STATUS_OPTIONS: { value: EvaluationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Статус: все' },
  ...FILTERABLE_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
]

export const MOBILE_SORT_OPTIONS: { value: SortKey; label: string }[] = SORT_COLUMNS.map(
  ({ key, label }) => ({ value: key, label }),
)
