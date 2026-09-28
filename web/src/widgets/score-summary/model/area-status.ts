import type { TeamArea } from '@/shared/api'

export interface AreaStatusPresentation {
  label: string
  detail: string
}

function areaLabel(areaName: string): string {
  return areaName.charAt(0).toUpperCase() + areaName.slice(1)
}

/** Text for the compact area summary. Missing reasons stay explicit instead of being guessed. */
export function describeAreaStatus(areaName: string, area: TeamArea): AreaStatusPresentation {
  const label = areaLabel(areaName)

  if (area.status === 'done') {
    return {
      label: `${label} оценён`,
      detail: `Оценено категорий: ${area.categories.length}`,
    }
  }

  if (area.status === 'running') {
    return {
      label: `${label} не оценён`,
      detail: area.error?.trim() || 'Проверка выполняется',
    }
  }

  return {
    label: `${label} не оценён`,
    detail: area.error?.trim() || 'Причина не указана',
  }
}
