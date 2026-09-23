import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react'
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
  const [step, setStep] = useState<'repo' | 'details' | 'review'>('repo')
  const [isChecking, setIsChecking] = useState(false)

  const checkRepository = async () => {
    if (!draft || isChecking) return
    let url: URL
    try {
      url = new URL(draft.repo.trim())
    } catch {
      setError('Укажите ссылку вида https://github.com/owner/repository.')
      return
    }
    const parts = url.pathname
      .replace(/\/$/, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      parts.length !== 2 ||
      parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))
    ) {
      setError('Укажите ссылку вида https://github.com/owner/repository.')
      return
    }
    const repo = `https://github.com/${parts.join('/')}`
    setIsChecking(true)
    setError('')
    try {
      const currentTeams = await getRegistryTeams()
      setTeams(currentTeams)
      if (
        currentTeams.some(
          (team) =>
            team.repo
              .replace(/\/$/, '')
              .replace(/\.git$/, '')
              .toLowerCase() === repo.toLowerCase(),
        )
      ) {
        setError('Этот репозиторий уже есть в реестре.')
        return
      }
      setDraft((current) =>
        current
          ? {
              ...current,
              repo,
              name: current.name || parts[1],
              id:
                current.id ||
                parts[1]
                  .toLowerCase()
                  .replace(/[^a-z0-9._-]/g, '-')
                  .slice(0, 64),
            }
          : current,
      )
      setStep('details')
    } catch {
      setError('Не удалось сверить репозиторий с реестром. Повторите проверку.')
    } finally {
      setIsChecking(false)
    }
  }

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
    setError('')
    setNotice('')
    try {
      await createRegistryTeam(draft)
      setDraft(null)
      setNotice('Команда добавлена. Оценка начнётся при следующем запуске.')
      setStep('repo')
      void loadTeams()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить команду')
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
              setStep('repo')
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

      {error && !draft ? (
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
          isChecking={isChecking}
          step={step}
          error={error}
          onStep={setStep}
          existingIds={teams.map((team) => team.id)}
          onCheck={() => void checkRepository()}
          onCancel={() => {
            setDraft(null)
            setError('')
            setStep('repo')
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
          {isLoading ? (
            <div className="p-4 text-sm text-fg-muted">
              <LoadingBar />
              Загружаем команды…
            </div>
          ) : null}
          {!isLoading && teams.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">В реестре пока нет команд.</p>
          ) : null}
          {!isLoading && teams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse text-left text-sm">
                <thead className="bg-muted-surface text-xs text-fg-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Команда
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Репозиторий
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Ветка
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Оценка
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        <span className="block">{team.name}</span>
                        <code className="text-xs font-normal text-fg-muted">{team.id}</code>
                      </th>
                      <td className="max-w-[22rem] truncate px-4 py-3">
                        <RepositoryLink value={team.repo} />
                      </td>
                      <td className="px-4 py-3">
                        <code>{team.branch}</code>
                      </td>
                      <td className="px-4 py-3">{team.active ? 'Включена' : 'Отключена'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

interface TeamFormProps {
  draft: TeamDraft
  existingIds: string[]
  isSaving: boolean
  isChecking: boolean
  step: 'repo' | 'details' | 'review'
  error: string
  onStep: (step: 'repo' | 'details' | 'review') => void
  onCheck: () => void
  onCancel: () => void
  onChange: (draft: TeamDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function LoadingBar() {
  return (
    <div aria-hidden="true" className="registry-loading-track mb-3">
      <span className="registry-loading-fill" />
    </div>
  )
}

function TeamForm({
  draft,
  existingIds,
  isSaving,
  isChecking,
  step,
  error,
  onStep,
  onCheck,
  onCancel,
  onChange,
  onSubmit,
}: TeamFormProps) {
  const change = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) =>
    onChange({ ...draft, [key]: value })
  const input = 'block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg'
  const button =
    'inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50'
  return (
    <section
      aria-label="Добавление команды"
      className="rounded-panel border border-line bg-surface p-4 sm:p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="m-0 text-lg font-semibold">Добавление команды</h2>
          <p className="mb-0 mt-1 text-sm text-fg-muted">Проверим данные до записи в реестр.</p>
        </div>
        <button
          className="min-h-11 rounded-control px-3 text-sm text-fg-muted"
          type="button"
          onClick={onCancel}
        >
          Закрыть
        </button>
      </div>
      <div data-slot="conversation" className="flex flex-col gap-4" aria-live="polite">
        <div
          data-slot="conversation-bubble"
          className="max-w-[90%] rounded-panel bg-muted-surface px-4 py-3 text-sm sm:max-w-[75%]"
        >
          <span className="mb-1 block text-xs font-semibold text-fg-muted">Помощник</span>С какого
          репозитория начать? Нужна ссылка на GitHub.
        </div>
        {step !== 'repo' && (
          <div
            data-slot="conversation-bubble"
            className="self-end max-w-[90%] rounded-panel bg-brand-soft px-4 py-3 text-sm break-all sm:max-w-[75%]"
          >
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Вы</span>
            {draft.repo}
          </div>
        )}
        {step !== 'repo' && (
          <div
            data-slot="conversation-bubble"
            className="max-w-[90%] rounded-panel bg-muted-surface px-4 py-3 text-sm sm:max-w-[75%]"
          >
            <span className="mb-1 block text-xs font-semibold text-fg-muted">Помощник</span>
            Репозитория нет в реестре. Уточните имя команды и ветку. Доступность кода проверит
            запуск оценки.
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-control bg-warn-bg p-3 text-sm text-warn-fg">
          {error}
        </p>
      )}
      {step === 'repo' && (
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            onCheck()
          }}
        >
          <label className="flex-1 space-y-1.5 text-sm font-medium">
            Ссылка на репозиторий
            <input
              className={input}
              type="url"
              required
              placeholder="https://github.com/owner/repository"
              value={draft.repo}
              onChange={(event) => change('repo', event.target.value)}
            />
          </label>
          <button className={button} disabled={isChecking} type="submit">
            Продолжить <ArrowRight size={16} aria-hidden="true" />
          </button>
          {isChecking && (
            <div className="w-full text-sm text-fg-muted">
              <LoadingBar />
              Проверяем ссылку и реестр…
            </div>
          )}
        </form>
      )}
      {step === 'details' && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (existingIds.some((id) => id.toLowerCase() === draft.id.toLowerCase())) {
              event.currentTarget
                .querySelector<HTMLInputElement>('input[pattern]')
                ?.setCustomValidity('Такой ID уже есть в реестре')
              event.currentTarget.reportValidity()
              return
            }
            onStep('review')
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium">
              Название команды
              <input
                className={input}
                maxLength={120}
                required
                value={draft.name}
                onChange={(event) => change('name', event.target.value)}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              ID команды
              <input
                className={input}
                maxLength={64}
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
                required
                value={draft.id}
                onChange={(event) => {
                  event.target.setCustomValidity('')
                  change('id', event.target.value)
                }}
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Ветка
              <input
                className={input}
                required
                value={draft.branch}
                onChange={(event) => change('branch', event.target.value)}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => change('active', event.target.checked)}
              />
              Включить в следующую оценку
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-control border border-line-strong px-4 text-sm"
              type="button"
              onClick={() => onStep('repo')}
            >
              Назад
            </button>
            <button className={button} type="submit">
              Посмотреть итог <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      {step === 'review' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-panel bg-muted-surface p-4 text-sm">
            <h3 className="m-0 mb-3 text-base font-semibold">Что попадёт в реестр</h3>
            <dl className="m-0 grid gap-2 sm:grid-cols-[9rem_1fr]">
              <dt className="text-fg-muted">Команда</dt>
              <dd className="m-0">
                {draft.name} <code className="text-xs text-fg-muted">{draft.id}</code>
              </dd>
              <dt className="text-fg-muted">Репозиторий</dt>
              <dd className="m-0 break-all">{draft.repo}</dd>
              <dt className="text-fg-muted">Ветка</dt>
              <dd className="m-0">{draft.branch}</dd>
              <dt className="text-fg-muted">Следующая оценка</dt>
              <dd className="m-0">{draft.active ? 'Включена' : 'Отключена'}</dd>
            </dl>
          </div>
          <p className="m-0 text-sm text-fg-muted">
            При следующем запуске оцениваются код выбранной ветки и находки по рубрикам. Добавление
            команды не запускает оценку.
          </p>
          {isSaving && <LoadingBar />}
          <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-control border border-line-strong px-4 text-sm"
              disabled={isSaving}
              type="button"
              onClick={() => onStep('details')}
            >
              Изменить
            </button>
            <button className={button} disabled={isSaving} type="submit">
              <Check size={16} aria-hidden="true" />
              {isSaving ? 'Сохраняем…' : 'Добавить в реестр'}
            </button>
          </form>
        </div>
      )}
    </section>
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
