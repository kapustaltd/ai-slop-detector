import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  createRun,
  getRun,
  isTerminal,
  type RunArea,
  type RunJob,
  type RunRequest,
  type RunStatus,
} from '@/shared/api'
import { Badge } from '@/shared/ui/shadcn/badge'
import { Button } from '@/shared/ui/shadcn/button'

const statusLabels: Record<RunStatus, string> = {
  queued: 'В очереди',
  running: 'Выполняется',
  succeeded: 'Завершён',
  failed: 'Ошибка',
}

const statusVariants: Record<RunStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'outline',
  running: 'secondary',
  succeeded: 'default',
  failed: 'destructive',
}

const initialForm: RunRequest = {
  repository_url: '',
  repository_id: '',
  branch: 'main',
  area: 'both',
}

function formatDuration(milliseconds?: number) {
  if (milliseconds == null) return '—'
  return `${(milliseconds / 1000).toFixed(1)} с`
}

function RunStatusCard({ job }: { job: RunJob }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">ID прогона</p>
          <p className="break-all font-mono text-sm">{job.id}</p>
        </div>
        <Badge variant={statusVariants[job.status]}>{statusLabels[job.status]}</Badge>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Репозиторий</dt>
          <dd className="break-all">{job.repository_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ветка</dt>
          <dd>{job.branch}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Область</dt>
          <dd>{job.area}</dd>
        </div>
      </dl>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(job.progress).map(([area, status]) => (
          <div
            key={area}
            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          >
            <span className="capitalize">{area}</span>
            <span className="text-muted-foreground">
              {statusLabels[status as RunStatus] ?? status}
            </span>
          </div>
        ))}
      </div>
      {job.status === 'failed' && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {job.error ?? 'Pipeline завершился с ошибкой.'}
        </p>
      )}
      {job.summary && (
        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Области готовы</p>
            <p className="font-semibold">{job.summary.areas_done}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Длительность</p>
            <p className="font-semibold">{formatDuration(job.summary.duration_ms)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Стоимость</p>
            <p className="font-semibold">${job.summary.cost_usd.toFixed(4)}</p>
          </div>
        </div>
      )}
      {(job.logs?.length ?? 0) > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Последние сообщения</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs leading-5">
            {job.logs?.join('\n')}
          </pre>
        </details>
      )}
    </section>
  )
}

export function RunnerPage() {
  const [form, setForm] = useState<RunRequest>(initialForm)
  const [token, setToken] = useState('')
  const [job, setJob] = useState<RunJob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!job || isTerminal(job.status)) return
    const timer = window.setInterval(() => {
      void getRun(job.id, token)
        .then(setJob)
        .catch((reason: unknown) =>
          setError(reason instanceof Error ? reason.message : 'Не удалось обновить статус'),
        )
    }, 2000)
    return () => window.clearInterval(timer)
  }, [job, token])

  const update = (field: keyof RunRequest, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setJob(null)
    setIsSubmitting(true)
    try {
      setJob(await createRun(form, token))
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать прогон')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" to="/">
          ← К рейтингу
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Операционный центр</p>
            <h1 className="text-3xl font-semibold tracking-tight">Новый прогон оценки</h1>
          </div>
          <Badge variant="outline">без shell-доступа</Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Укажи репозиторий и область анализа. Сервер сам запустит проверенный pipeline;
          произвольные команды из браузера не выполняются.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <form className="space-y-5 rounded-xl border bg-card p-5" onSubmit={submit}>
          <div className="space-y-1">
            <h2 className="font-semibold">Параметры запуска</h2>
            <p className="text-sm text-muted-foreground">
              Поддерживаются GitHub, GitLab и GitVerse.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">HTTPS URL репозитория</span>
            <input
              required
              className="h-10 rounded-md border bg-background px-3"
              placeholder="https://github.com/org/repository.git"
              value={form.repository_url}
              onChange={(event) => update('repository_url', event.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">ID команды</span>
              <input
                required
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
                className="h-10 rounded-md border bg-background px-3"
                placeholder="team-01"
                value={form.repository_id}
                onChange={(event) => update('repository_id', event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Ветка</span>
              <input
                required
                className="h-10 rounded-md border bg-background px-3"
                value={form.branch}
                onChange={(event) => update('branch', event.target.value)}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Область оценки</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={form.area}
              onChange={(event) => update('area', event.target.value as RunArea)}
            >
              <option value="both">Backend + frontend</option>
              <option value="backend">Только backend</option>
              <option value="frontend">Только frontend</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Токен оператора</span>
            <input
              type="password"
              autoComplete="off"
              className="h-10 rounded-md border bg-background px-3"
              placeholder="Нужен в production"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Не сохраняется и не передаётся провайдеру оценки.
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Создаём прогон…' : 'Запустить оценку'}
          </Button>
        </form>

        <aside className="space-y-4 rounded-xl border bg-muted/30 p-5">
          <h2 className="font-semibold">Что произойдёт</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">01</span> — сервер проверит URL, ветку и
              область.
            </li>
            <li>
              <span className="font-medium text-foreground">02</span> — pipeline скачает репозиторий
              в изолированное рабочее пространство.
            </li>
            <li>
              <span className="font-medium text-foreground">03</span> — provider оценит код и
              validator проверит JSON-отчёт.
            </li>
            <li>
              <span className="font-medium text-foreground">04</span> — здесь появится статус и
              безопасный итог прогона.
            </li>
          </ol>
          <p className="border-t pt-4 text-xs text-muted-foreground">
            Запуск не изменяет рейтинг автоматически. Публикация нового дата-бандла остаётся
            отдельной операторской операцией.
          </p>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs font-medium text-muted-foreground">Разрешённая операция</p>
            <code className="mt-1 block break-all text-xs">
              evaluate —area {form.area} —branch {form.branch || 'main'} —repo{' '}
              {form.repository_id || 'team-id'}
            </code>
          </div>
        </aside>
      </div>

      {job && <RunStatusCard job={job} />}
    </main>
  )
}
