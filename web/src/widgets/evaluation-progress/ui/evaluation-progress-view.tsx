import { AlertCircle, Check, CircleDashed, LoaderCircle } from 'lucide-react'

import type { RegistryEvaluationProgress } from '@/shared/api'
import { Context, ContextTrigger, ContextContent } from '@/shared/ui'
import { AgentActivity } from './agent-activity'

import { areaLabels, getCurrentAction, type EvaluationAreaName } from '../model/labels'

interface EvaluationProgressViewProps {
  progress: RegistryEvaluationProgress
  className?: string
}

const areas: EvaluationAreaName[] = ['backend', 'frontend']
const statusLabels: Record<RegistryEvaluationProgress['status'], string> = {
  done: 'Готово',
  failed: 'Ошибка',
  no_data: 'Нет оценки',
  running: 'Выполняется',
}

export function EvaluationProgressView({ progress, className = '' }: EvaluationProgressViewProps) {
  return (
    <section aria-label="Ход оценки" className={`border-y border-line py-4 ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold">Ход оценки</h2>
          <p role="status" className="mb-0 mt-1 text-sm text-fg-muted">
            {getCurrentAction(progress)}
          </p>
        </div>
        <ProgressStatus progress={progress} />
      </header>

      <Pipeline progress={progress} />

      <ul aria-label="Области оценки" className="m-0 mt-4 grid list-none p-0 sm:grid-cols-2">
        {areas.map((area) => {
          const result = progress.areas.find((item) => item.area === area)
          const status = result?.status ?? 'queued'

          return (
            <li key={area} className="border-t border-line py-3 sm:pr-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{areaLabels[area]}</span>
                <AreaState area={area} status={status} />
              </div>
              {result ? (
                <div>
                  <p className="mb-0 mt-1 text-sm text-fg-muted">
                    {result.completed_categories} из {result.total_categories} категорий
                    {result.included_files > 0 ? ` · ${result.included_files} файлов` : ''}
                    {result.excluded_files > 0 ? ` · ${result.excluded_files} пропущено` : ''}
                  </p>
                  <Context usedTokens={result.input_tokens ?? 0}>
                    <ContextTrigger>
                      <button
                        type="button"
                        className="mt-2 text-xs text-link underline decoration-dotted underline-offset-4"
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
              ) : null}
            </li>
          )
        })}
      </ul>

      <AgentActivity progress={progress} />
    </section>
  )
}

type PipelineStatus = 'pending' | 'running' | 'done' | 'warning' | 'failed'

const pipelineSteps = [
  ['repo', 'Получен репозиторий'],
  ['clone', 'Клонирование'],
  ['analyze', 'Анализ структуры'],
  ['backend', 'Backend'],
  ['frontend', 'Frontend'],
  ['report', 'Формирование итоговой оценки'],
] as const

function Pipeline({ progress }: { progress: RegistryEvaluationProgress }) {
  const order: Record<string, number> = {
    waiting: 0,
    dispatching: 1,
    runner_queued: 1,
    analyzing: 2,
    publishing: 5,
    done: 6,
  }
  const current = order[progress.stage] ?? 0
  const hasEvents = progress.events.length > 0
  const backend = progress.areas.find((area) => area.area === 'backend')
  const frontend = progress.areas.find((area) => area.area === 'frontend')
  const statusFor = (key: string): PipelineStatus => {
    if (
      progress.status === 'failed' &&
      (key === 'report' || progress.events.at(-1)?.kind === 'error')
    )
      return 'failed'
    if (key === 'repo')
      return hasEvents || current > 0
        ? 'done'
        : progress.status === 'running'
          ? 'running'
          : 'pending'
    if (key === 'clone') return current > 1 ? 'done' : current === 1 ? 'running' : 'pending'
    if (key === 'analyze') return current > 2 ? 'done' : current === 2 ? 'running' : 'pending'
    if (key === 'backend') return areaPipelineStatus(backend)
    if (key === 'frontend') return areaPipelineStatus(frontend)
    if (progress.status === 'done') return 'done'
    return current >= 5 ? 'running' : 'pending'
  }

  return (
    <ol aria-label="Этапы проверки" className="m-0 mt-5 grid list-none gap-0 p-0 sm:grid-cols-6">
      {pipelineSteps.map(([key, label], index) => {
        const status = statusFor(key)
        const Icon =
          status === 'done'
            ? Check
            : status === 'failed'
              ? AlertCircle
              : status === 'running'
                ? LoaderCircle
                : CircleDashed
        return (
          <li key={key} className="relative flex gap-2 pb-3 sm:block sm:pb-0 sm:pr-2">
            {index < pipelineSteps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute left-[7px] top-4 hidden h-px w-[calc(100%-12px)] bg-line sm:block"
              />
            ) : null}
            <div className="relative flex items-center gap-2 bg-surface pr-2">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${pipelineTone(status)}`}
              >
                <Icon
                  size={10}
                  aria-hidden="true"
                  className={status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}
                />
              </span>
              <span className={`text-xs ${status === 'pending' ? 'text-fg-subtle' : 'text-fg'}`}>
                {label}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function areaPipelineStatus(
  area: RegistryEvaluationProgress['areas'][number] | undefined,
): PipelineStatus {
  if (!area) return 'pending'
  if (area.status === 'done') return 'done'
  if (area.status === 'failed') return 'failed'
  if (area.status === 'running') return 'running'
  return 'pending'
}

function pipelineTone(status: PipelineStatus) {
  if (status === 'done') return 'border-sev-strength-fg bg-sev-strength-fg text-surface'
  if (status === 'running') return 'border-brand bg-brand text-on-accent'
  if (status === 'failed') return 'border-sev-critical-fg bg-sev-critical-bg text-sev-critical-fg'
  return 'border-line-strong bg-surface text-fg-subtle'
}

function ProgressStatus({ progress }: { progress: RegistryEvaluationProgress }) {
  const { status, stage } = progress
  const Icon =
    status === 'running'
      ? LoaderCircle
      : status === 'done'
        ? Check
        : status === 'failed'
          ? AlertCircle
          : CircleDashed
  const label =
    status !== 'running'
      ? statusLabels[status]
      : stage === 'waiting'
        ? 'В очереди'
        : stage === 'dispatching'
          ? 'Передаётся'
          : stage === 'runner_queued'
            ? 'Ждёт исполнителя'
            : stage === 'analyzing'
              ? 'Анализируется'
              : stage === 'publishing'
                ? 'Публикуется'
                : statusLabels[status]

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm ${status === 'failed' ? 'text-sev-critical-fg' : 'text-fg-muted'}`}
    >
      <Icon
        aria-hidden="true"
        size={15}
        className={status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}
      />
      {label}
    </span>
  )
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
            ? 'Нет данных'
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
