import type { RegistryEvaluationProgress, RubricBundle } from '@/shared/api'

export type EvaluationAreaName = 'backend' | 'frontend'

export const areaLabels: Record<EvaluationAreaName, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
}

export function getAreaProgress(progress: RegistryEvaluationProgress, area: EvaluationAreaName) {
  return progress.areas.find((item) => item.area === area)
}

export function getAreaCategories(rubric: RubricBundle | undefined) {
  return rubric?.categories ?? []
}

export function getCurrentAction(progress: RegistryEvaluationProgress) {
  const active = progress.areas.filter((area) => area.status === 'running')
  if (active.length === 1) return `Проверяется область ${areaLabels[active[0].area]}.`
  if (active.length > 1)
    return `Проверяются области: ${active.map((area) => areaLabels[area.area]).join(', ')}.`
  if (progress.stage === 'publishing') return 'Сохраняются проверенные результаты.'
  if (progress.status === 'done') return 'Оценка завершена.'
  if (progress.status === 'failed') return 'Оценка остановилась с ошибкой.'
  if (progress.stage === 'waiting') return 'Задание ожидает запуска.'
  if (progress.stage === 'dispatching') return 'Задание передаётся сервису оценки.'
  if (progress.stage === 'runner_queued') return 'Задание ожидает свободного runner.'
  return 'Подготавливаю репозиторий к анализу.'
}

export function getNextAction(progress: RegistryEvaluationProgress) {
  if (progress.status === 'done') return 'Результаты доступны в отчёте команды.'
  if (progress.status === 'failed') return 'Последние подтверждённые события сохранены выше.'
  const queued = progress.areas.find((area) => area.status === 'queued')
  return queued
    ? `Далее начнётся проверка области ${areaLabels[queued.area]}.`
    : 'После проверки области результаты появятся в отчёте.'
}
