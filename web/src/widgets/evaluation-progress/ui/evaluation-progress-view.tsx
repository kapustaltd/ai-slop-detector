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
