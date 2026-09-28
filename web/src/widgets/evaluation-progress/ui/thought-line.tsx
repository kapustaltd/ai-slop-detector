import { AlertCircle, Check, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'

import type { RegistryEvaluationProgress } from '@/shared/api'

import { areaLabels } from '../model/labels'
import { effectiveProgressStatus } from '../model/state'

interface ThoughtLineProps {
  progress: RegistryEvaluationProgress
  updatesUnavailable?: boolean
}

type ThoughtStepState = 'running' | 'done' | 'failed'

interface ThoughtStep {
  id: number
  area?: string
  title: string
  detail?: string
  state: ThoughtStepState
  isCurrent: boolean
}

export function ThoughtLine({ progress, updatesUnavailable = false }: ThoughtLineProps) {
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(true)
  const [showPrevious, setShowPrevious] = useState(false)
  const allEvents = useMemo(
    () => progress.events.filter((event) => event.kind !== 'context'),
    [progress.events],
  )
  const status = effectiveProgressStatus(progress)
  const lastEvent = allEvents.at(-1)
  const hasCurrentEvent =
    status === 'running' &&
    lastEvent !== undefined &&
    lastEvent.state !== 'done' &&
    lastEvent.state !== 'failed'
  const completedEvents = hasCurrentEvent ? allEvents.slice(0, -1) : allEvents
  const currentEvent = hasCurrentEvent ? lastEvent : undefined
  const previousCount = Math.max(0, completedEvents.length - 3)
  const visibleCompleted = showPrevious ? completedEvents : completedEvents.slice(-3)
  const visibleEvents = currentEvent ? [...visibleCompleted, currentEvent] : visibleCompleted

  const steps: ThoughtStep[] = visibleEvents.map((event) => {
    const isCurrent = event.sequence === currentEvent?.sequence
    return {
      id: event.sequence,
      area: event.area ? areaLabels[event.area] : undefined,
      title: formatActionTitle(event, isCurrent, updatesUnavailable),
      detail: event.detail,
      state:
        event.state === 'failed' || event.kind === 'error'
          ? 'failed'
          : isCurrent
            ? 'running'
            : 'done',
      isCurrent,
    }
  })

  return (
    <section className="evaluation-thought-line mt-8" aria-label="Последние действия проверки">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-[15px]/[1.4] font-medium text-fg">Ход проверки</p>
          <p className="m-0 mt-1 text-sm text-fg-muted">
            Последние подтверждённые действия и текущее действие
          </p>
        </div>
        {steps.length > 0 ? (
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-sm text-link transition-colors hover:bg-muted-surface active:scale-[0.96]"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Свернуть ход' : `Показать ход · ${steps.length}`}
            <ChevronDown
              className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              size={14}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {open && steps.length > 0 ? (
        <div className="mt-4">
          {previousCount > 0 ? (
            <button
              type="button"
              className="mb-3 min-h-10 text-sm text-link underline decoration-dotted underline-offset-4"
              aria-expanded={showPrevious}
              onClick={() => setShowPrevious((value) => !value)}
            >
              {showPrevious
                ? 'Скрыть предыдущие действия'
                : `Показать предыдущие действия · ${previousCount}`}
            </button>
          ) : null}
          <ol className="m-0 list-none space-y-3 ps-4" aria-label="Последние действия проверки">
            <AnimatePresence initial={false}>
              {steps.map((step) => (
                <motion.li
                  key={step.id}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
                  className="flex items-start gap-2 text-sm"
                >
                  <ThoughtStepIcon state={step.state} />
                  <div className="min-w-0">
                    <p className="m-0 text-[15px]/[1.4] font-medium text-fg">{step.title}</p>
                    {step.area || step.detail ? (
                      <p className="m-0 mt-1 break-words text-sm leading-relaxed text-fg-muted">
                        {step.area ? `${step.area} · ` : ''}
                        {step.detail ?? 'Подтверждённый этап проверки.'}
                      </p>
                    ) : null}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      ) : null}

      {open && steps.length === 0 ? (
        <p role="status" className="m-0 mt-4 text-sm text-fg-muted">
          {status === 'running'
            ? 'Ожидаем первое подтверждённое действие проверки…'
            : 'Подтверждённых действий для этого запуска нет.'}
        </p>
      ) : null}
    </section>
  )
}

function formatActionTitle(
  event: RegistryEvaluationProgress['events'][number],
  isCurrent: boolean,
  updatesUnavailable: boolean,
) {
  if (isCurrent && updatesUnavailable) return 'Выполнялось при последнем обновлении'
  if (isCurrent && event.kind === 'tool') return `Проверяю: ${event.title}`
  if (!isCurrent && event.title === 'Репозиторий подготовлен') {
    return 'Рабочая копия создана, области проверки определены'
  }
  if (!isCurrent && event.kind === 'tool' && event.state === 'done') {
    return `Завершено: ${event.title}`
  }
  if (event.kind === 'error') return `Ошибка: ${event.title}`
  return event.title
}

function ThoughtStepIcon({ state }: { state: ThoughtStepState }) {
  return (
    <span
      className="evaluation-action-icon relative mt-0.5 size-4 shrink-0"
      aria-label={state === 'running' ? 'Выполняется' : state === 'failed' ? 'Ошибка' : 'Готово'}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center text-sev-strength-fg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${state === 'done' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
      >
        <Check size={15} />
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center text-brand transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${state === 'running' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
      >
        <span className="size-2 rounded-full bg-current" />
      </span>
      <span
        aria-hidden="true"
        className={`absolute inset-0 flex items-center justify-center text-sev-critical-fg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${state === 'failed' ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
      >
        <AlertCircle size={15} />
      </span>
    </span>
  )
}
