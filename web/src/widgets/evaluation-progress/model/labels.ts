import type { RegistryEvaluationProgress } from '@/shared/api'

export type EvaluationAreaName = 'backend' | 'frontend'

export const areaLabels: Record<EvaluationAreaName, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
}

export function getAreaProgress(progress: RegistryEvaluationProgress, area: EvaluationAreaName) {
  return progress.areas.find((item) => item.area === area)
}

export function getCurrentAction(progress: RegistryEvaluationProgress) {
  const active = progress.areas.filter((area) => area.status === 'running')
  if (active.length === 1) return `Проверяется область ${areaLabels[active[0].area]}.`
  if (active.length > 1)
    return `Проверяются области: ${active.map((area) => areaLabels[area.area]).join(', ')}.`
  if (progress.stage === 'publishing') return 'Сохраняются проверенные результаты.'
  if (progress.status === 'done') return 'Оценка готова.'
  if (progress.status === 'failed') return 'Проверка прервана.'
  if (progress.stage === 'waiting') return 'Проверка в очереди.'
  if (progress.stage === 'dispatching') return 'Передаём репозиторий на проверку.'
  if (progress.stage === 'runner_queued') return 'Ожидаем свободного исполнителя.'
  return 'Подготавливаем репозиторий к проверке.'
}
