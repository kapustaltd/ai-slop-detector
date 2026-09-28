import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'

import type { RegistryEvaluationProgress } from '@/shared/api'
import {
  MessageResponse,
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
  Tool,
  ToolContent,
  ToolHeader,
} from '@/shared/ui/activity-elements'

import { areaLabels } from '../model/labels'

type Event = RegistryEvaluationProgress['events'][number]

export function AgentActivity({ progress }: { progress: RegistryEvaluationProgress }) {
  const [filter, setFilter] = useState('all')
  const [follow, setFollow] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const latestSequence = progress.events.at(-1)?.sequence
  useEffect(() => {
    if (follow && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [latestSequence, follow, filter])
  const events = progress.events.filter((event) => filter === 'all' || event.area === filter)
  const active = progress.status === 'running'
  return (
    <details className="evaluation-technical-log mt-8">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-[15px]/[1.4] font-medium marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="flex items-center gap-2">
          Технический журнал
          <span className="text-sm font-normal text-fg-muted">{progress.events.length}</span>
        </span>
        <ChevronDown
          className="evaluation-log-chevron shrink-0 text-fg-muted"
          size={16}
          aria-hidden="true"
        />
      </summary>
      <div className="evaluation-log-content pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-sm font-medium">События проверки</h3>
          <div className="flex gap-1" role="group" aria-label="Фильтр событий">
            {['all', 'backend', 'frontend'].map((area) => (
              <button
                type="button"
                key={area}
                aria-pressed={filter === area}
                className={`min-h-10 rounded-md px-3 text-xs transition-colors ${filter === area ? 'bg-muted-open text-fg' : 'text-fg-muted hover:text-fg'}`}
                onClick={() => setFilter(area)}
              >
                {area === 'all' ? 'Все' : areaLabels[area as 'backend' | 'frontend']}
              </button>
            ))}
          </div>
        </div>
        <div
          className="mt-4 max-h-[38rem] overflow-y-auto overscroll-contain pr-2"
          ref={scrollRef}
          onScroll={(event) => {
            const el = event.currentTarget
            setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
          }}
          aria-label="Хронология проверки"
          role="region"
        >
          {events.map((event) => (
            <ActivityEvent key={event.sequence} event={event} active={active} />
          ))}
          {events.length === 0 && (
            <p className="text-sm text-fg-muted">
              {active
                ? 'Ожидаем первые действия агента. Они появятся автоматически.'
                : 'Для этой проверки события не записаны.'}
            </p>
          )}
          {active && (
            <p role="status" className="py-3 text-sm text-fg-muted">
              Следующее действие появится после подтверждённого обновления.
            </p>
          )}
        </div>
        {!follow && (
          <button
            type="button"
            className="mt-2 min-h-10 text-sm text-link"
            onClick={() => setFollow(true)}
          >
            К последним событиям ↓
          </button>
        )}
        {progress.events.length >= 20 && (
          <p className="text-xs text-fg-muted">Показаны последние 20 событий.</p>
        )}
      </div>
    </details>
  )
}

function ActivityEvent({ event, active }: { event: Event; active: boolean }) {
  const source = event.source
  const isRunning = active && event.state === 'running'
  return (
    <article className="relative border-l border-line pb-5 pl-5 text-sm">
      <span className="absolute -left-1 top-1 size-2 rounded-full bg-fg-muted" />
      <div className="mb-2 flex items-center gap-2 text-xs text-fg-muted">
        {event.area && <span>{areaLabels[event.area]}</span>}
        <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString('ru-RU')}</time>
        {event.category_id && <span className="font-mono">{event.category_id}</span>}
      </div>
      {event.kind === 'tool' ? (
        <>
          <Tool defaultOpen={false} className="mb-0 border-line">
            <ToolHeader
              type="dynamic-tool"
              toolName={event.title}
              title={event.title}
              state={
                event.state === 'failed'
                  ? 'output-error'
                  : isRunning
                    ? 'input-available'
                    : event.state === 'done'
                      ? 'output-available'
                      : 'output-error'
              }
            />
            <ToolContent className="break-words pt-0 font-mono text-xs text-fg-muted">
              {event.detail}
            </ToolContent>
          </Tool>
          <p className="m-0 mt-2 text-sm text-fg-muted">
            {humanizeToolDetail(event.detail, event.title)}
          </p>
          {!active && event.state === 'running' ? (
            <p className="m-0 mt-1 text-sm text-warn-fg">Завершение инструмента не подтверждено.</p>
          ) : null}
        </>
      ) : event.kind === 'reasoning' ? (
        <div className="border-l-2 border-line-strong pl-3">
          <p className="m-0 font-medium">{event.title}</p>
          {event.detail ? <p className="m-0 mt-1 text-sm text-fg-muted">{event.detail}</p> : null}
        </div>
      ) : (
        <>
          <p className={`m-0 font-medium ${event.kind === 'error' ? 'text-sev-critical-fg' : ''}`}>
            {event.title}
          </p>
          {event.detail &&
            (event.kind === 'response' ? (
              <MessageResponse className="mt-2 text-sm">{event.detail}</MessageResponse>
            ) : (
              <p className="mb-0 mt-1 whitespace-pre-wrap break-words text-fg-muted">
                {event.detail}
              </p>
            ))}
        </>
      )}
      {source && (
        <Sources defaultOpen className="mb-0 mt-3">
          <SourcesTrigger count={1}>
            <BookOpen size={14} />
            Источник
            <ChevronDown size={12} />
          </SourcesTrigger>
          <SourcesContent>
            {source.permalink && /^https?:\/\//.test(source.permalink) ? (
              <Source href={source.permalink} title={`${source.file}:${source.line_start}`} />
            ) : (
              <span className="font-mono">
                {source.file}:{source.line_start}
              </span>
            )}
          </SourcesContent>
        </Sources>
      )}
    </article>
  )
}

function humanizeToolDetail(detail: string | undefined, title: string) {
  if (!detail) return `${title} · детали появятся после завершения`
  try {
    const parsed = JSON.parse(detail) as { command?: string; path?: string; file?: string }
    if (parsed.command) return `Terminal · ${parsed.command}`
    if (parsed.path || parsed.file) return `Read · ${parsed.path ?? parsed.file}`
  } catch {
    // Short scanner summaries are already safe to show inline.
  }
  return detail.startsWith('{') || detail.startsWith('[')
    ? `${title} · детали доступны ниже`
    : detail
}
