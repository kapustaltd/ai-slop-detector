import { AlertCircle, Check, CircleDashed, LoaderCircle } from 'lucide-react'

import type { RegistryEvaluationProgress } from '@/shared/api'
import {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineHeader,
  TimelineItem,
  TimelineMarker,
  TimelineRail,
  TimelineTime,
  TimelineTitle,
} from '@/shared/ui/shadcn/timeline'

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
  const events = progress.events.slice(-8)

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
                <p className="mb-0 mt-1 text-sm text-fg-muted">
                  {result.completed_categories} из {result.total_categories} категорий
                  {result.included_files > 0 ? ` · ${result.included_files} файлов` : ''}
                  {result.excluded_files > 0 ? ` · ${result.excluded_files} пропущено` : ''}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="mt-1 border-t border-line pt-3">
        <h3 className="m-0 text-sm font-medium">События проверки</h3>
        {events.length > 0 ? (
          <Timeline aria-label="Хронология проверки" className="mt-3">
            {events.map((event) => {
              const isError = event.kind === 'error'
              return (
                <TimelineItem key={event.sequence} status={isError ? 'default' : 'done'}>
                  <TimelineRail>
                    <TimelineMarker
                      className={isError ? 'border-sev-critical-border text-sev-critical-fg' : ''}
                    >
                      {isError ? <AlertCircle aria-hidden="true" /> : null}
                    </TimelineMarker>
                    <TimelineConnector />
                  </TimelineRail>
                  <TimelineContent>
                    <TimelineHeader>
                      <TimelineTitle className={isError ? 'text-sev-critical-fg' : ''}>
                        {event.title}
                      </TimelineTitle>
                      <TimelineTime dateTime={event.at}>{formatEventTime(event.at)}</TimelineTime>
                    </TimelineHeader>
                    {event.detail || event.source ? (
                      <TimelineDescription>
                        {event.detail}
                        {event.source ? (
                          <>
                            {event.detail ? ' · ' : null}
                            {event.source.permalink ? (
                              <a className="text-link" href={event.source.permalink}>
                                {event.source.file}:{event.source.line_start}
                              </a>
                            ) : (
                              <span className="font-mono">
                                {event.source.file}:{event.source.line_start}
                              </span>
                            )}
                          </>
                        ) : null}
                      </TimelineDescription>
                    ) : null}
                  </TimelineContent>
                </TimelineItem>
              )
            })}
          </Timeline>
        ) : (
          <p className="mb-0 mt-2 text-sm text-fg-muted">
            {progress.status === 'running'
              ? 'События пока не поступили.'
              : 'Для этой оценки события не записаны.'}
          </p>
        )}
      </div>
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

function formatEventTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
}
