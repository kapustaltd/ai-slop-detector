import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  checkRegistryApi,
  clearRegistryToken,
  createRegistryTeam,
  deleteRegistryTeam,
  getRegistryTeams,
  readRegistryToken,
  RegistryApiError,
  saveRegistryToken,
  updateRegistryTeam,
  type RegistryTeam,
} from '@/shared/api'

type TeamDraft = Pick<RegistryTeam, 'id' | 'name' | 'repo' | 'branch' | 'active'>

const emptyTeam: TeamDraft = { id: '', name: '', repo: '', branch: 'main', active: true }

export function TeamManagementPage() {
  const [token, setToken] = useState(readRegistryToken)
  const [tokenInput, setTokenInput] = useState('')
  const [teams, setTeams] = useState<RegistryTeam[]>([])
  const [draft, setDraft] = useState<TeamDraft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadTeams = useCallback(async (activeToken: string) => {
    try {
      const apiReady = await checkRegistryApi()
      setApiAvailable(apiReady)
      if (!apiReady)
        throw new RegistryApiError(
          'API управления не запущен. Запустите registry-api и обновите страницу.',
          0,
        )
      setIsLoading(true)
      setError('')
      setTeams(await getRegistryTeams(activeToken))
    } catch (cause) {
      if (cause instanceof RegistryApiError && cause.status === 401) {
        clearRegistryToken()
        setToken('')
      }
      setError(
        cause instanceof RegistryApiError && cause.status === 0
          ? 'API управления не запущен. Запустите registry-api и обновите страницу.'
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
    const storedToken = readRegistryToken()
    void checkRegistryApi()
      .then((available) => {
        if (!active) return null
        setApiAvailable(available)
        if (!available) {
          throw new RegistryApiError(
            'API управления не запущен. Запустите registry-api и обновите страницу.',
            0,
          )
        }
        if (!storedToken) return null
        return getRegistryTeams(storedToken)
      })
      .then((loadedTeams) => {
        if (active && loadedTeams) setTeams(loadedTeams)
      })
      .catch((cause: unknown) => {
        if (!active) return
        if (cause instanceof RegistryApiError && cause.status === 401) {
          clearRegistryToken()
          setToken('')
        }
        setError(loadErrorMessage(cause))
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const connect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextToken = tokenInput.trim()
    if (!nextToken) return
    saveRegistryToken(nextToken)
    setToken(nextToken)
    setTokenInput('')
    void loadTeams(nextToken)
  }

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    setIsSaving(true)
    setIsLoading(true)
    setError('')
    setNotice('')
    try {
      const team = { ...draft, ...(editingId ? { id: editingId } : {}) }
      if (editingId) await updateRegistryTeam(token, team)
      else await createRegistryTeam(token, team)
      setDraft(null)
      setEditingId(null)
      setNotice(editingId ? 'Изменения сохранены' : 'Команда добавлена')
      await loadTeams(token)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить команду')
    } finally {
      setIsSaving(false)
    }
  }

  const removeTeam = async (id: string) => {
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await deleteRegistryTeam(token, id)
      setConfirmingId(null)
      setNotice('Команда удалена')
      await loadTeams(token)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить команду')
    } finally {
      setIsSaving(false)
    }
  }

  const beginEdit = (team: RegistryTeam) => {
    setDraft({
      id: team.id,
      name: team.name,
      repo: team.repo,
      branch: team.branch,
      active: team.active,
    })
    setEditingId(team.id)
    setConfirmingId(null)
    setError('')
    setNotice('')
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
        {token && apiAvailable ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draft !== null || isSaving}
            type="button"
            onClick={() => {
              setDraft({ ...emptyTeam })
              setEditingId(null)
              setError('')
              setNotice('')
            }}
          >
            <Plus aria-hidden="true" size={17} />
            Добавить команду
          </button>
        ) : null}
      </header>

      {!apiAvailable && !error ? (
        <p className="rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted">
          API управления не запущен. Запустите registry-api и обновите страницу.
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

      {!token && apiAvailable ? (
        <form
          onSubmit={connect}
          className="max-w-xl space-y-3 rounded-panel border border-line bg-surface p-4"
        >
          <h2 className="text-base font-semibold">Подключиться к реестру</h2>
          <label className="block space-y-1.5 text-sm font-medium">
            Токен API
            <input
              autoComplete="current-password"
              className="min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg"
              onChange={(event) => setTokenInput(event.target.value)}
              required
              type="password"
              value={tokenInput}
            />
          </label>
          <button
            className="min-h-11 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground"
            type="submit"
          >
            Подключить
          </button>
        </form>
      ) : null}

      {token && draft ? (
        <TeamForm
          draft={draft}
          editing={editingId !== null}
          isSaving={isSaving}
          onCancel={() => {
            setDraft(null)
            setEditingId(null)
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

      {token && apiAvailable ? (
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
                  {confirmingId === team.id ? (
                    <div
                      className="flex min-h-11 flex-wrap items-center gap-2"
                      aria-label={`Подтверждение удаления ${team.name}`}
                    >
                      <span className="text-sm">Удалить команду?</span>
                      <button
                        className="min-h-11 rounded-control border border-line-strong px-3 text-sm"
                        disabled={isSaving}
                        onClick={() => setConfirmingId(null)}
                        type="button"
                      >
                        Отмена
                      </button>
                      <button
                        className="min-h-11 rounded-control border border-line-strong px-3 text-sm font-medium"
                        disabled={isSaving}
                        onClick={() => void removeTeam(team.id)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        aria-label={`Изменить ${team.name}`}
                        className="flex min-h-11 items-center gap-2 rounded-control border border-line-strong px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={draft !== null || isSaving}
                        onClick={() => beginEdit(team)}
                        type="button"
                      >
                        <Pencil aria-hidden="true" size={15} />
                        Изменить
                      </button>
                      <button
                        aria-label={`Удалить ${team.name}`}
                        className="flex min-h-11 items-center gap-2 rounded-control border border-line-strong px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={draft !== null || isSaving || teams.length === 1}
                        title={
                          teams.length === 1
                            ? 'В реестре должна остаться хотя бы одна команда'
                            : undefined
                        }
                        onClick={() => setConfirmingId(team.id)}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={15} />
                        Удалить
                      </button>
                    </div>
                  )}
                </article>
              ))
            : null}
        </section>
      ) : null}

      {token && apiAvailable ? (
        <button
          className="text-sm text-fg-muted underline underline-offset-4"
          onClick={() => {
            clearRegistryToken()
            setToken('')
            setTeams([])
            setDraft(null)
            setNotice('')
            setError('')
          }}
          type="button"
        >
          Сменить токен
        </button>
      ) : null}
    </main>
  )
}

interface TeamFormProps {
  draft: TeamDraft
  editing: boolean
  isSaving: boolean
  onCancel: () => void
  onChange: (draft: TeamDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function TeamForm({ draft, editing, isSaving, onCancel, onChange, onSubmit }: TeamFormProps) {
  const change = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) => {
    onChange({ ...draft, [key]: value })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-panel border border-line bg-surface p-4 sm:p-5"
    >
      <h2 className="m-0 text-base font-semibold">
        {editing ? 'Изменить команду' : 'Новая команда'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {editing ? (
          <div className="space-y-1.5 text-sm">
            <span className="block font-medium">ID команды</span>
            <code className="flex min-h-11 items-center text-fg-muted">{draft.id}</code>
          </div>
        ) : (
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
        )}
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
    ? 'API управления не запущен. Запустите registry-api и обновите страницу.'
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
