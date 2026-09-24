import { AlertCircle, Check, Circle, LoaderCircle } from 'lucide-react'

import type { RegistryEvaluationProgress, RubricBundle } from '@/shared/api'

import {
  areaLabels,
  getAreaCategories,
  getAreaProgress,
  getCurrentAction,
  getNextAction,
  type EvaluationAreaName,
} from '../model/labels'

interface EvaluationProgressViewProps {
  progress: RegistryEvaluationProgress
  rubrics?: Partial<Record<EvaluationAreaName, RubricBundle>>
  className?: string
}

const areas: EvaluationAreaName[] = ['backend', 'frontend']

export function EvaluationProgressView({
  progress,
  rubrics = {},
  className = '',
}: EvaluationProgressViewProps) {
  const events = progress.events.slice(-8)
  const observations = events.filter((event) => event.kind === 'scan' || event.kind === 'finding')
  const activity = events.filter((event) => event.kind !== 'scan' && event.kind !== 'finding')
  const activeAreas = progress.areas.filter((area) => area.status === 'running')

  return (
    <section
      aria-label="Ход анализа"
      className={`rounded-panel border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-lg font-semibold">Ход анализа</h2>
          <p role="status" className="mb-0 mt-1 text-sm text-fg-muted">
            {getCurrentAction(progress)}
          </p>
        </div>
        {progress.status === 'running' ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              size={16}
              aria-hidden="true"
            />
            Выполняется
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h3 className="mb-2 mt-0 text-sm font-medium">Будущий отчёт</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {areas.map((area) => {
              const state = getAreaProgress(progress, area)?.status ?? 'queued'
              const categories = getAreaCategories(rubrics[area])
              return (
                <div key={area} className="rounded-control border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{areaLabels[area]}</span>
                    <AreaState area={area} status={state} />
                  </div>
                  {categories.length > 0 ? (
                    <ul className="mb-0 mt-2 space-y-1 pl-4 text-sm text-fg-muted">
                      {categories.map((category) => (
                        <li key={category.id} className="flex items-start justify-between gap-2">
                          <span>{category.name}</span>
                          <span className="shrink-0 text-xs">
                            {state === 'done'
                              ? 'Готово'
                              : state === 'failed'
                                ? 'Ошибка'
                                : state === 'no_data'
                                  ? 'Недоступно'
                                  : 'В очереди'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {state === 'running' ? (
                    <p className="mb-0 mt-2 text-xs text-fg-muted">
                      {getAreaProgress(progress, area)?.included_files ?? 0} файлов включено в
                      проверку
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-1 mt-0 text-sm font-medium">Что сейчас проверяется</h3>
          <p className="m-0 text-sm text-fg-muted">
            {activeAreas.length > 0
              ? `Проверяются материалы: ${activeAreas.map((area) => areaLabels[area.area]).join(', ')}. Результаты появятся после проверки и валидации отчётов областей.`
              : getCurrentAction(progress)}
          </p>
          <h3 className="mb-1 mt-3 text-sm font-medium">Почему это делается</h3>
          <p className="m-0 text-sm text-fg-muted">
            Области проверяются отдельно, чтобы показывать опубликованные части отчёта по мере их
            готовности.
          </p>
          <h3 className="mb-1 mt-3 text-sm font-medium">Следующий шаг</h3>
          <p className="m-0 text-sm text-fg-muted">{getNextAction(progress)}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <h3 className="mb-2 mt-0 text-sm font-medium">Что обнаружено</h3>
        {observations.length > 0 ? (
          <ol className="m-0 grid gap-2 p-0 text-sm">
            {observations.map((event) => (
              <ProgressEvent key={event.sequence} event={event} />
            ))}
          </ol>
        ) : (
          <p className="m-0 text-sm text-fg-muted">
            {progress.status === 'running'
              ? 'Получаем структуру репозитория…'
              : 'Подтверждённых наблюдений для этого запуска пока нет.'}
          </p>
        )}
        {activity.length > 0 ? (
          <>
            <h3 className="mb-2 mt-4 text-sm font-medium">Активность сервиса</h3>
            <ol className="m-0 grid gap-2 p-0 text-sm">
              {activity.map((event) => (
                <ProgressEvent key={event.sequence} event={event} />
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </section>
  )
}

function ProgressEvent({ event }: { event: RegistryEvaluationProgress['events'][number] }) {
  const EventIcon = event.kind === 'error' ? AlertCircle : Check
  const time = new Intl.DateTimeFormat('ru', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(event.at),
  )
  return (
    <li className="flex items-start gap-2">
      <EventIcon aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-link" />
      <span>
        <span className="font-medium">{event.title}</span>
        <time dateTime={event.at} className="ml-2 text-xs text-fg-subtle">
          {time}
        </time>
        {event.detail ? <span className="text-fg-muted"> — {event.detail}</span> : null}
        {event.source ? (
          event.source.permalink ? (
            <a className="ml-2 text-link" href={event.source.permalink}>
              {event.source.file}:{event.source.line_start}
            </a>
          ) : (
            <span className="ml-2 text-fg-muted">
              {event.source.file}:{event.source.line_start}
            </span>
          )
        ) : null}
      </span>
    </li>
  )
}

function AreaState({ area, status }: { area: EvaluationAreaName; status: string }) {
  const Icon = status === 'done' ? Check : status === 'running' ? LoaderCircle : Circle
  const label =
    status === 'done'
      ? 'Готово'
      : status === 'running'
        ? 'Анализируется'
        : status === 'failed'
          ? 'Ошибка'
          : 'В очереди'
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-fg-muted"
      aria-label={`${areaLabels[area]}: ${label}`}
    >
      <Icon
        aria-hidden="true"
        size={14}
        className={status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}
      />
      {label}
    </span>
  )
}
