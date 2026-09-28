import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertCircle, Check, CircleDashed, CloudOff, LoaderCircle, Minus } from 'lucide-react'

import type { RegistryEvaluationProgress } from '@/shared/api'
import { Context, ContextTrigger, ContextContent } from '@/shared/ui/evaluation-context'

import { areaLabels, getCurrentAction, type EvaluationAreaName } from '../model/labels'
import {
  effectiveProgressStatus,
  formatElapsed,
  pipelineSteps,
  pipelineStatusFor,
  type PipelineStatus,
} from '../model/state'
import { ThoughtLine } from './thought-line'

const AgentActivity = lazy(() =>
  import('./agent-activity').then(({ AgentActivity: Activity }) => ({ default: Activity })),
)

interface EvaluationProgressViewProps {
  progress: RegistryEvaluationProgress
  className?: string
  refresh?: {
    unavailable: boolean
    lastUpdatedAt: number | null
    onRetry: () => void
  }
}

const areas: EvaluationAreaName[] = ['backend', 'frontend']
const statusLabels: Record<RegistryEvaluationProgress['status'], string> = {
  done: 'Проверка завершена',
  failed: 'Завершено с ошибкой',
  no_data: 'Ожидает проверки',
  running: 'Проверка выполняется',
}

export function EvaluationProgressView({
  progress,
  className = '',
  refresh,
}: EvaluationProgressViewProps) {
  const updatesUnavailable = refresh?.unavailable ?? false

  return (
    <section
      aria-label="Ход проверки"
      className={`evaluation-progress-panel mx-auto w-full max-w-[1080px] ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[18px]/[1.3] font-semibold">Ход проверки</h2>
          <p role="status" className="mb-0 mt-2 flex items-center gap-2 text-[15px]/[1.45]">
            {effectiveProgressStatus(progress) === 'running' && !updatesUnavailable ? (
              <LoaderCircle
                aria-hidden="true"
                size={15}
                className="shrink-0 animate-spin text-brand motion-reduce:animate-none"
              />
            ) : null}
            <span className={updatesUnavailable ? 'text-warn-fg' : 'text-fg-muted'}>
              {updatesUnavailable && effectiveProgressStatus(progress) === 'running'
                ? 'Выполнялось при последнем обновлении'
                : getCurrentAction(progress)}
            </span>
          </p>
        </div>
        <ProgressStatus progress={progress} refresh={refresh} />
      </header>

      <Pipeline progress={progress} />
      <ThoughtLine progress={progress} updatesUnavailable={updatesUnavailable} />

      <ul aria-label="Области оценки" className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2">
        {areas.map((area) => {
          const result = progress.areas.find((item) => item.area === area)
          const status = result?.status ?? (progress.status === 'running' ? 'queued' : 'no_data')

          return (
            <li
              key={area}
              className="evaluation-area-card min-h-[132px] rounded-card border border-line bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-[15px]/[1.4] font-medium">{areaLabels[area]}</h3>
                <AreaState area={area} status={status} />
              </div>
              {result ? (
                <div className="mt-5">
                  <p className="m-0 text-[15px]/[1.45] text-fg">
                    Проверено категорий: {result.completed_categories} из {result.total_categories}
                  </p>
                  <p className="m-0 mt-1 text-sm text-fg-muted">
                    {result.status === 'done'
                      ? 'Итог доступен в отчёте.'
                      : result.completed_categories > 0
                        ? 'Промежуточные выводы доступны.'
                        : 'Ожидаем первые результаты.'}
                  </p>
                  <Context usedTokens={result.input_tokens ?? 0}>
                    <ContextTrigger>
                      <button
                        type="button"
                        className="mt-3 min-h-10 text-sm text-link underline decoration-dotted underline-offset-4"
                      >
                        Контекст проверки
                      </button>
                    </ContextTrigger>
                    <ContextContent className="text-sm">
                      <p className="font-medium">{areaLabels[area]} · Контекст</p>
                      <p>
                        {result.included_files} файлов включено, {result.excluded_files} исключено.
                      </p>
                      <p>
                        {result.input_tokens !== undefined
                          ? `Вход: ${result.input_tokens.toLocaleString('ru-RU')} токенов · выход: ${(result.output_tokens ?? 0).toLocaleString('ru-RU')}`
                          : 'Расход токенов появится после ответа модели.'}
                      </p>
                    </ContextContent>
                  </Context>
                </div>
              ) : (
                <p className="m-0 mt-5 text-sm text-fg-muted">Категории ожидают запуска.</p>
              )}
            </li>
          )
        })}
      </ul>

      <Suspense
        fallback={
          <p role="status" className="mb-0 mt-8 text-sm text-fg-muted">
            Загружаем технический журнал…
          </p>
        }
      >
        <AgentActivity progress={progress} />
      </Suspense>
    </section>
  )
}

function Pipeline({ progress }: { progress: RegistryEvaluationProgress }) {
  return (
    <ol aria-label="Этапы проверки" className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-4">
      {pipelineSteps.map(([key, label], index) => {
        const status = pipelineStatusFor(progress, key)
        return (
          <li key={key} className="relative min-w-0">
            {index < pipelineSteps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-5 right-[-16px] top-2 hidden h-px bg-line sm:block"
              />
            ) : null}
            <div
              className="relative flex min-w-0 items-start gap-2 bg-bg pe-2"
              aria-current={status === 'running' ? 'step' : undefined}
              aria-label={`${label}: ${pipelineStatusLabel(status)}`}
            >
              <span
                className={`evaluation-pipeline-step flex size-4 shrink-0 items-center justify-center rounded-full border ${pipelineTone(status)}`}
                data-status={status}
              >
                <PipelineMarker status={status} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px]/[1.35] font-medium text-fg">{label}</span>
                <span className={`mt-0.5 block text-sm ${pipelineStatusTextTone(status)}`}>
                  {pipelineStatusLabel(status)}
                </span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function PipelineMarker({ status }: { status: PipelineStatus }) {
  if (status === 'done') return <Check size={10} aria-hidden="true" />
  if (status === 'failed') return <AlertCircle size={10} aria-hidden="true" />
  if (status === 'skipped') return <Minus size={10} aria-hidden="true" />
  if (status === 'running') {
    return <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
  }
  return <span aria-hidden="true" className="size-1.5 rounded-full border border-current" />
}

function pipelineStatusLabel(status: PipelineStatus) {
  if (status === 'done') return 'Готово'
  if (status === 'running') return 'Проверяется'
  if (status === 'failed') return 'Ошибка'
  if (status === 'skipped') return 'Пропущено'
  return 'Ожидает'
}

function pipelineTone(status: PipelineStatus) {
  if (status === 'done') return 'border-sev-strength-fg bg-sev-strength-fg text-surface'
  if (status === 'running') return 'border-brand bg-brand-soft text-brand'
  if (status === 'failed') return 'border-sev-critical-fg bg-sev-critical-bg text-sev-critical-fg'
  if (status === 'skipped') return 'border-line-strong bg-muted-surface text-fg-muted'
  return 'border-line-strong bg-surface text-fg-subtle'
}

function pipelineStatusTextTone(status: PipelineStatus) {
  if (status === 'failed') return 'text-sev-critical-fg'
  if (status === 'running') return 'text-brand'
  if (status === 'pending') return 'text-fg-subtle'
  return 'text-fg-muted'
}

function ProgressStatus({
  progress,
  refresh,
}: {
  progress: RegistryEvaluationProgress
  refresh?: EvaluationProgressViewProps['refresh']
}) {
  const status = effectiveProgressStatus(progress)
  const Icon = status === 'done' ? Check : status === 'failed' ? AlertCircle : CircleDashed
  const elapsed = useElapsedSeconds(progress)
  const label = statusLabels[status]

  return (
    <div className="flex max-w-full flex-col items-start gap-2 text-sm sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-fg-muted">
        <span
          className={`inline-flex items-center gap-1.5 ${status === 'failed' ? 'text-sev-critical-fg' : ''}`}
        >
          <Icon aria-hidden="true" size={15} />
          {label}
        </span>
        {elapsed !== null ? (
          <span className="tabular-nums text-fg-muted">Прошло {formatElapsed(elapsed)}</span>
        ) : null}
      </div>
      {refresh?.unavailable ? (
        <div
          role="status"
          className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right text-sm text-warn-fg"
        >
          <span className="inline-flex items-center gap-1.5">
            <CloudOff aria-hidden="true" size={14} />
            Обновления недоступны · последние данные {formatLastUpdatedAt(refresh.lastUpdatedAt)}
          </span>
          <button
            type="button"
            className="min-h-10 rounded-control px-2 font-medium text-link underline underline-offset-4 transition-colors hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.96]"
            onClick={refresh.onRetry}
          >
            Повторить
          </button>
        </div>
      ) : null}
    </div>
  )
}

function useElapsedSeconds(progress: RegistryEvaluationProgress) {
  const startedAt = progress.started_at ? Date.parse(progress.started_at) : Number.NaN
  const [now, setNow] = useState(() => Date.now())
  const status = effectiveProgressStatus(progress)

  useEffect(() => {
    if (status !== 'running' || !Number.isFinite(startedAt)) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [startedAt, status])

  if (!Number.isFinite(startedAt)) return null
  const end =
    status === 'running'
      ? now
      : Date.parse(progress.events.at(-1)?.at ?? progress.started_at ?? '') || startedAt
  return Math.max(0, Math.floor((end - startedAt) / 1000))
}

function formatLastUpdatedAt(timestamp: number | null) {
  if (timestamp === null) return 'время неизвестно'
  return `в ${new Date(timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function AreaState({ area, status }: { area: EvaluationAreaName; status: string }) {
  const label =
    status === 'done'
      ? 'Готово'
      : status === 'running'
        ? 'Проверяется'
        : status === 'failed'
          ? 'Ошибка'
          : status === 'no_data'
            ? 'Пропущено'
            : 'Ожидает запуска'

  return (
    <span
      className={`text-sm ${status === 'failed' ? 'text-sev-critical-fg' : 'text-fg-muted'}`}
      aria-label={`${areaLabels[area]}: ${label}`}
    >
      {label}
    </span>
  )
}
