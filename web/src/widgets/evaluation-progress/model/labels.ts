import type { RegistryEvaluationProgress } from '@/shared/api'

import { effectiveProgressStatus } from './state'

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
  const status = effectiveProgressStatus(progress)
  if (progress.stage === 'publishing' && status === 'running') {
    return 'Публикуем проверенные результаты.'
  }
  if (status === 'done') return 'Оценка готова.'
  if (status === 'failed') return 'Проверка завершена с ошибкой.'
  if (status === 'no_data') return 'Проверка ожидает запуска.'
  if (progress.stage === 'waiting') return 'Проверка в очереди.'
  if (progress.stage === 'dispatching') return 'Передаём репозиторий на проверку.'
  if (progress.stage === 'runner_queued') return 'Ожидаем свободного исполнителя.'
  return 'Подготавливаем репозиторий к проверке.'
}
