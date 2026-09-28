import type { RegistryEvaluationProgress } from '@/shared/api'

export type PipelineStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed'

export const pipelineSteps = [
  ['preparation', 'Подготовка'],
  ['backend', 'Backend'],
  ['frontend', 'Frontend'],
  ['report', 'Итог'],
] as const

const evaluationAreas = ['backend', 'frontend'] as const

export function isAreaTerminal(status: string | undefined) {
  return status === 'done' || status === 'failed' || status === 'no_data'
}

export function areasAreSettled(progress: RegistryEvaluationProgress) {
  // A legacy response has no area telemetry. Its coarse terminal status is the
  // only confirmed fact available to the client.
  if (progress.areas.length === 0) return progress.status !== 'running'
  return evaluationAreas.every((name) => {
    const area = progress.areas.find((item) => item.area === name)
    return area !== undefined && isAreaTerminal(area.status)
  })
}

export function effectiveProgressStatus(progress: RegistryEvaluationProgress) {
  if (progress.status === 'done' && !areasAreSettled(progress)) return 'running' as const
  return progress.status
}

export function areaPipelineStatus(
  progress: RegistryEvaluationProgress,
  area: 'backend' | 'frontend',
): PipelineStatus {
  const result = progress.areas.find((item) => item.area === area)
  if (result?.status === 'done') return 'done'
  if (result?.status === 'failed') return 'failed'
  if (result?.status === 'no_data') return 'skipped'
  if (result?.status === 'running') return 'running'

  // A terminal coarse response without area telemetry is legacy data. Do not
  // invent completed areas; make the missing detail explicit instead.
  if (progress.areas.length === 0 && progress.status !== 'running') return 'skipped'
  return 'pending'
}

export function pipelineStatusFor(
  progress: RegistryEvaluationProgress,
  key: (typeof pipelineSteps)[number][0],
): PipelineStatus {
  const currentStage = progress.stage
  const effectiveStatus = effectiveProgressStatus(progress)
  const lastEvent = progress.events.at(-1)

  if (key === 'backend' || key === 'frontend') return areaPipelineStatus(progress, key)

  if (key === 'preparation') {
    if (['analyzing', 'publishing', 'done'].includes(currentStage)) return 'done'
    if (effectiveStatus === 'failed' && lastEvent?.kind === 'error' && !lastEvent.area)
      return 'failed'
    return effectiveStatus === 'running' ? 'running' : 'pending'
  }

  if (key === 'report') {
    if (effectiveStatus === 'failed') return 'failed'
    if (currentStage === 'publishing') return 'running'
    if (effectiveStatus === 'done' && areasAreSettled(progress)) return 'done'
    return 'pending'
  }

  if (effectiveStatus === 'done' && areasAreSettled(progress)) return 'done'
  return 'pending'
}

export function formatElapsed(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}
