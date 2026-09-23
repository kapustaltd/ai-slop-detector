import { ArrowLeft, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  checkRegistryApi,
  createRegistryTeam,
  getRegistryTeams,
  RegistryApiError,
  type RegistryTeam,
} from '@/shared/api'

type TeamDraft = Pick<RegistryTeam, 'id' | 'name' | 'repo' | 'branch' | 'active'>

const emptyTeam: TeamDraft = { id: '', name: '', repo: '', branch: 'main', active: true }

export function TeamManagementPage() {
  const [teams, setTeams] = useState<RegistryTeam[]>([])
  const [draft, setDraft] = useState<TeamDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTeams = useCallback(async () => {
    try {
      const apiReady = await checkRegistryApi()
      setApiAvailable(apiReady)
      if (!apiReady)
        throw new RegistryApiError('Реестр команд временно недоступен. Обновите страницу позже.', 0)
      setIsLoading(true)
      setError('')
      setTeams(await getRegistryTeams())
    } catch (cause) {
      setError(
        cause instanceof RegistryApiError && cause.status === 0
          ? 'Реестр команд временно недоступен. Обновите страницу позже.'
          : cause instanceof Error
            ? cause.message
            : 'Не удалось загрузить реестр команд',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void checkRegistryApi()
      .then((available) => {
        if (!active) return null
        setApiAvailable(available)
        if (!available) {
          throw new RegistryApiError(
            'Реестр команд временно недоступен. Обновите страницу позже.',
            0,
          )
        }
        return getRegistryTeams()
      })
      .then((loadedTeams) => {
        if (active && loadedTeams) setTeams(loadedTeams)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(loadErrorMessage(cause))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    setIsSaving(true)
    setIsLoading(true)
    setError('')
    setNotice('')
    try {
      await createRegistryTeam(draft)
      setDraft(null)
      setNotice('Команда добавлена. В рейтинге она появится без балла до следующей оценки.')
      await loadTeams()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить команду')
      setIsLoading(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4 pr-12">
        <div>
          <Link
            className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-fg-muted no-underline"
            to="/"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Рейтинг
          </Link>
          <h1 className="text-h1 m-0">Команды</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Изменения применятся при следующем запуске оценки.
          </p>
        </div>
        {apiAvailable ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draft !== null || isSaving}
            type="button"
            onClick={() => {
              setDraft({ ...emptyTeam })
              setError('')
              setNotice('')
            }}
          >
            <Plus aria-hidden="true" size={17} />
            Добавить команду
          </button>
        ) : null}
      </header>

      {!apiAvailable && !error && !isLoading ? (
        <p className="rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted">
          Реестр команд временно недоступен. Обновите страницу позже.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-panel border border-warn-border bg-warn-bg p-4 text-sm text-warn-fg"
        >
          {error}
        </div>
      ) : null}

      {draft ? (
        <TeamForm
          draft={draft}
          isSaving={isSaving}
          onCancel={() => {
            setDraft(null)
            setError('')
          }}
          onChange={setDraft}
          onSubmit={submitTeam}
        />
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-fg-muted">
          {notice}
        </p>
      ) : null}

      {apiAvailable ? (
        <section
          aria-busy={isLoading}
          aria-label="Реестр команд"
          className="divide-y divide-line rounded-panel border border-line bg-surface"
        >
          {isLoading ? <p className="p-4 text-sm text-fg-muted">Загрузка…</p> : null}
          {!isLoading && teams.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">В реестре пока нет команд.</p>
          ) : null}
          {!isLoading
            ? teams.map((team) => (
                <article
                  key={team.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h2 className="m-0 text-base font-semibold">{team.name}</h2>
                      <code className="text-xs text-fg-muted">{team.id}</code>
                      <span className="text-xs text-fg-muted">
                        {team.active ? 'Активна' : 'Отключена'}
                      </span>
                    </div>
                    <RepositoryLink value={team.repo} />
                    <p className="m-0 text-sm text-fg-muted">Ветка: {team.branch}</p>
                  </div>
                </article>
              ))
            : null}
        </section>
      ) : null}
    </main>
  )
}

interface TeamFormProps {
  draft: TeamDraft
  isSaving: boolean
  onCancel: () => void
  onChange: (draft: TeamDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function TeamForm({ draft, isSaving, onCancel, onChange, onSubmit }: TeamFormProps) {
  const change = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) => {
    onChange({ ...draft, [key]: value })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-panel border border-line bg-surface p-4 sm:p-5"
    >
      <h2 className="m-0 text-base font-semibold">Новая команда</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium">
          ID команды
          <input
            autoComplete="off"
            className="block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg"
            maxLength={64}
            onChange={(event) => change('id', event.target.value)}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
            placeholder="team-05"
            required
            value={draft.id}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Название
          <input
            autoComplete="organization"
            className="block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg"
            maxLength={120}
            onChange={(event) => change('name', event.target.value)}
            required
            value={draft.name}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
          Ссылка на репозиторий
          <input
            autoComplete="url"
            className="block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg"
            onChange={(event) => change('repo', event.target.value)}
            placeholder="https://github.com/org/project"
            required
            type="url"
            value={draft.repo}
          />
        </label>
        <label className="space-y-1.5 text-sm font-medium">
          Ветка
          <input
            autoComplete="off"
            className="block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg"
            onChange={(event) => change('branch', event.target.value)}
            required
            value={draft.branch}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            checked={draft.active}
            onChange={(event) => change('active', event.target.checked)}
            type="checkbox"
          />
          Активна для следующих запусков
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-11 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          className="min-h-11 rounded-control border border-line-strong px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}

function safeRepositoryHref(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function loadErrorMessage(cause: unknown) {
  return cause instanceof RegistryApiError && cause.status === 0
    ? 'Реестр команд временно недоступен. Обновите страницу позже.'
    : cause instanceof Error
      ? cause.message
      : 'Не удалось загрузить реестр команд'
}

function RepositoryLink({ value }: { value: string }) {
  const href = safeRepositoryHref(value)
  return href ? (
    <a className="block break-all text-sm" href={href} rel="noreferrer" target="_blank">
      {value}
    </a>
  ) : (
    <code className="block break-all text-sm">{value}</code>
  )
}
