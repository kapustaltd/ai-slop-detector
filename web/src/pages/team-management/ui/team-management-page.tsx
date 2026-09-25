import { ArrowRight, Check, MoreHorizontal, Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  checkRegistryApi,
  createRegistryTeam,
  deleteRegistryTeam,
  getRegistryEvaluationProgress,
  getRegistryEvaluationStatuses,
  getRegistryTeams,
  RegistryApiError,
  updateRegistryTeam,
  type RegistryEvaluationProgress,
  type RegistryEvaluationStatus,
  type RegistryTeam,
} from '@/shared/api'
import { Skeleton } from '@/shared/ui'
import { EvaluationProgressView } from '@/widgets/evaluation-progress'

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
  const [trackedTeam, setTrackedTeam] = useState<TeamDraft | null>(null)
  const [step, setStep] = useState<'repo' | 'details' | 'review'>('repo')
  const [isChecking, setIsChecking] = useState(false)
  const [editing, setEditing] = useState<RegistryTeam | null>(null)
  const [deleting, setDeleting] = useState<RegistryTeam | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RegistryEvaluationStatus>>({})

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

  useEffect(() => {
    if (!apiAvailable) return
    let active = true
    const poll = () => {
      void getRegistryEvaluationStatuses()
        .then((next) => {
          if (active) setStatuses(next)
        })
        .catch(() => {})
    }
    poll()
    const timer = window.setInterval(poll, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [apiAvailable])

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    setIsSaving(true)
    setError('')
    try {
      await updateRegistryTeam(editing)
      setEditing(null)
      await loadTeams()
      setNotice('Команда обновлена.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось обновить команду')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setIsSaving(true)
    setError('')
    try {
      await deleteRegistryTeam(deleting.id)
      setTrackedTeam((current) => (current?.id === deleting.id ? null : current))
      setDeleting(null)
      await loadTeams()
      setNotice('Команда удалена из реестра.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить команду')
    } finally {
      setIsSaving(false)
    }
  }

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await createRegistryTeam(draft)
      setTrackedTeam(draft)
      setDraft(null)
      setNotice('Команда добавлена в реестр.')
      setStep('repo')
      void loadTeams()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить команду')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1040px] space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-h1 m-0">Команды</h1>
          <p className="mt-1 text-sm text-fg-muted">Реестр команд и запуск новых проверок.</p>
        </div>
        {apiAvailable ? (
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={draft !== null || editing !== null || deleting !== null || isSaving}
            type="button"
            onClick={() => {
              setDraft({ ...emptyTeam })
              setStep('repo')
              setError('')
              setNotice('')
              setTrackedTeam(null)
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
        <div className="sheet-overlay" role="presentation">
          <div
            className="sheet-panel sheet-wide"
            role="dialog"
            aria-modal="true"
            aria-label="Добавление команды"
          >
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
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="sheet-overlay" role="presentation">
          <form
            aria-label={`Изменение команды ${editing.name}`}
            className="sheet-panel sheet-wide gap-4 overflow-y-auto p-5"
            onSubmit={(event) => void saveEdit(event)}
          >
            <div>
              <h2 className="m-0 text-lg font-semibold">Изменить команду {editing.name}</h2>
              <p className="m-0 mt-1 text-sm text-fg-muted">ID {editing.id} останется прежним.</p>
            </div>
            <div className="grid gap-3">
              <label className="text-sm">
                Название
                <input
                  className="mt-1 block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3"
                  required
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </label>
              <label className="text-sm">
                Репозиторий
                <input
                  className="mt-1 block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3"
                  required
                  type="url"
                  value={editing.repo}
                  onChange={(event) => setEditing({ ...editing, repo: event.target.value })}
                />
              </label>
              <label className="text-sm">
                Ветка
                <input
                  className="mt-1 block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3"
                  required
                  value={editing.branch}
                  onChange={(event) => setEditing({ ...editing, branch: event.target.value })}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                />
                Активна
              </label>
            </div>
            <div className="mt-auto flex gap-2 border-t border-line pt-4">
              <button
                className="min-h-11 rounded-control bg-primary px-4 text-primary-foreground disabled:opacity-50"
                disabled={isSaving}
                type="submit"
              >
                Сохранить
              </button>
              <button
                className="min-h-11 rounded-control border border-line px-4"
                type="button"
                onClick={() => {
                  setEditing(null)
                  setError('')
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleting ? (
        <div className="sheet-overlay" role="presentation">
          <section
            aria-label={`Удаление команды ${deleting.name}`}
            className="sheet-panel sheet-wide h-auto self-end gap-3 border-t p-5 sm:mr-5 sm:mb-5 sm:h-auto sm:max-h-[320px] sm:self-end sm:rounded-panel"
          >
            <h2 className="m-0 text-lg font-semibold">Удалить команду {deleting.name}?</h2>
            <p className="m-0 text-sm">
              Запись исчезнет из реестра и текущего рейтинга. Сохранённые отчёты останутся на
              сервере.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                className="min-h-11 rounded-control bg-primary px-4 text-primary-foreground disabled:opacity-50"
                disabled={isSaving}
                type="button"
                onClick={() => void confirmDelete()}
              >
                Удалить команду
              </button>
              <button
                className="min-h-11 rounded-control border border-line px-4"
                type="button"
                onClick={() => {
                  setDeleting(null)
                  setError('')
                }}
              >
                Отмена
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-fg-muted">
          {notice}
        </p>
      ) : null}

      {trackedTeam ? <RepositoryProgress key={trackedTeam.id} team={trackedTeam} /> : null}

      {apiAvailable ? (
        <section
          aria-busy={isLoading}
          aria-label="Реестр команд"
          className="divide-y divide-line border-y border-line"
        >
          {isLoading ? <RegistryLoadingSkeleton /> : null}
          {!isLoading && teams.length === 0 ? (
            <div className="px-4 py-6">
              <p className="m-0 font-medium">Команд пока нет</p>
              <p className="mb-0 mt-1 text-sm text-fg-muted">
                Добавьте первую команду с помощью кнопки выше.
              </p>
            </div>
          ) : null}
          {!isLoading && teams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
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
                    <th scope="col" className="px-4 py-3 font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {teams.map((team) => (
                    <tr key={team.id}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        {team.active && statuses[team.id] === 'done' ? (
                          <Link
                            className="block min-h-8 content-center text-link underline-offset-2 hover:underline"
                            to={`/team/${encodeURIComponent(team.id)}`}
                          >
                            {team.name}
                          </Link>
                        ) : (
                          <span className="block min-h-8 content-center">{team.name}</span>
                        )}
                        {team.name === team.id ? null : (
                          <code className="text-xs font-normal text-fg-muted">{team.id}</code>
                        )}
                      </th>
                      <td className="max-w-[22rem] truncate px-4 py-3">
                        <RepositoryLink value={team.repo} />
                      </td>
                      <td className="px-4 py-3">
                        <code>{team.branch}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span>
                            {team.active
                              ? statuses[team.id] === 'done'
                                ? 'Готова'
                                : statuses[team.id] === 'failed'
                                  ? 'Ошибка'
                                  : statuses[team.id] === 'running'
                                    ? 'Проверяется'
                                    : 'Нет оценки'
                              : 'Отключена'}
                          </span>
                          {team.active &&
                          (statuses[team.id] === 'done' || statuses[team.id] === 'running') ? (
                            <Link
                              className="inline-flex min-h-9 items-center text-sm text-link"
                              to={`/team/${encodeURIComponent(team.id)}`}
                            >
                              {statuses[team.id] === 'running' ? 'Ход оценки' : 'Открыть отчёт'}
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <details open className="relative inline-block">
                          <summary className="flex min-h-11 list-none cursor-pointer items-center gap-1 rounded-control border border-line px-2.5 text-sm text-fg-muted hover:bg-muted-surface">
                            <MoreHorizontal aria-hidden="true" size={17} />
                            Действия
                          </summary>
                          <div className="absolute right-0 top-[calc(100%+4px)] z-10 flex min-w-40 flex-col gap-1 rounded-panel border border-line bg-surface p-1 shadow-lg">
                            <button
                              aria-label={`Изменить ${team.name}`}
                              className="min-h-10 rounded-control px-3 text-left text-sm hover:bg-muted-surface"
                              type="button"
                              onClick={() => {
                                setEditing(team)
                                setDeleting(null)
                                setDraft(null)
                                setError('')
                                setNotice('')
                              }}
                            >
                              Изменить
                            </button>
                            <button
                              aria-label={`Удалить ${team.name}`}
                              className="min-h-10 rounded-control px-3 text-left text-sm text-sev-critical-fg hover:bg-sev-critical-bg"
                              type="button"
                              onClick={() => {
                                setDeleting(team)
                                setEditing(null)
                                setDraft(null)
                                setError('')
                                setNotice('')
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </details>
                      </td>
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

function RepositoryProgress({ team }: { team: TeamDraft }) {
  const [progress, setProgress] = useState<RegistryEvaluationProgress | null>(() =>
    team.active ? null : { status: 'no_data', stage: 'waiting', areas: [], events: [] },
  )
  const [pollError, setPollError] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)

  useEffect(() => {
    if (progress?.status !== 'running' || startedAt === null) return
    const timer = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))),
      1000,
    )
    return () => clearInterval(timer)
  }, [progress?.status, startedAt])

  useEffect(() => {
    if (!team.active) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const nextProgress = await getRegistryEvaluationProgress(team.id)
        if (stopped) return
        setPollError(false)
        setProgress(nextProgress)
        if (nextProgress.started_at) {
          const timestamp = new Date(nextProgress.started_at).getTime()
          if (Number.isFinite(timestamp)) {
            setStartedAt(timestamp)
            setElapsed(Math.max(0, Math.floor((Date.now() - timestamp) / 1000)))
          }
        } else if (nextProgress.status === 'running') {
          setStartedAt((current) => current ?? Date.now())
        }
        if (nextProgress.status !== 'running') return
      } catch {
        if (stopped) return
        setPollError(true)
      }
      timer = setTimeout(() => void poll(), 1000)
    }
    void poll()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [team.active, team.id])

  const statusMessage = !progress
    ? pollError
      ? 'Не удалось получить статус. Повторяем запрос.'
      : 'Получаем статус оценки…'
    : progress.status === 'no_data'
      ? 'Оценка ещё не запущена или пока недоступна.'
      : null

  return (
    <section
      aria-label={`Обработка репозитория ${team.name}`}
      className="border-y border-line py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 text-base font-semibold">Оценка репозитория</h2>
        <RepositoryLink value={team.repo} />
      </div>
      {progress && progress.status !== 'no_data' ? (
        <EvaluationProgressView progress={progress} className="mt-3" />
      ) : null}
      {statusMessage ? (
        <p role="status" className="mb-0 mt-3 text-sm text-fg-muted">
          {statusMessage}
        </p>
      ) : null}
      {pollError && progress ? (
        <p role="status" className="mb-0 mt-3 text-sm text-fg-muted">
          Не удалось обновить статус. Показываем последнее полученное состояние.
        </p>
      ) : null}
      {progress?.status === 'running' ? (
        <p className="mb-0 mt-1 text-sm text-fg-muted">
          Прошло {Math.floor(elapsed / 60)} мин {String(elapsed % 60).padStart(2, '0')} с.
        </p>
      ) : null}
      {progress?.status === 'done' || progress?.status === 'running' ? (
        <Link
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm text-link"
          to={`/team/${encodeURIComponent(team.id)}`}
        >
          {progress?.status === 'running' ? 'Смотреть ход оценки' : 'Открыть отчёт'}{' '}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : null}
    </section>
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

function RegistryLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_0.8fr] gap-4 bg-muted-surface px-4 py-3">
          <span className="text-xs font-medium text-fg-muted">Команда</span>
          <span className="text-xs font-medium text-fg-muted">Репозиторий</span>
          <span className="text-xs font-medium text-fg-muted">Ветка</span>
          <span className="text-xs font-medium text-fg-muted">Оценка</span>
          <span className="text-xs font-medium text-fg-muted">Действия</span>
        </div>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="grid h-[58px] grid-cols-[1.2fr_1.5fr_0.8fr_0.8fr_0.8fr] items-center gap-4 border-t border-line px-4"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
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
    <section aria-label="Добавление команды" className="py-4">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 className="m-0 text-base font-semibold">
            {step === 'repo'
              ? 'Новый репозиторий'
              : step === 'details'
                ? 'Данные команды'
                : 'Проверьте данные команды'}
          </h2>
          <p className="mb-0 mt-1 text-sm text-fg-muted">
            {step === 'repo'
              ? 'Укажите GitHub-ссылку.'
              : step === 'details'
                ? 'Название и ветка, которые попадут в реестр.'
                : 'Проверьте название, репозиторий и ветку.'}
          </p>
        </div>
        <button
          className="min-h-11 rounded-control px-3 text-sm text-fg-muted"
          type="button"
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
      <div aria-label="Шаги добавления команды" className="mb-5 mt-0 max-w-3xl" role="group">
        <p className="m-0 text-sm font-medium">
          Шаг {['repo', 'details', 'review'].indexOf(step) + 1} из 3 ·{' '}
          {step === 'repo'
            ? 'Репозиторий'
            : step === 'details'
              ? 'Данные команды'
              : 'Подтверждение'}
        </p>
        <div aria-hidden="true" className="mt-3 flex gap-1">
          {['repo', 'details', 'review'].map((key, index) => (
            <span
              key={key}
              className={`h-1 flex-1 rounded-full ${index <= ['repo', 'details', 'review'].indexOf(step) ? 'bg-brand' : 'bg-track'}`}
            />
          ))}
        </div>
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
          <p role="status" className="mb-0 text-sm text-fg-muted">
            Репозиторий ещё не проверялся.
          </p>
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
          <div className="border-y border-line py-3 text-sm">
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
            После добавления запустим проверку ветки <code>{draft.branch}</code>.
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
              {isSaving ? 'Сохраняем…' : 'Сохранить команду'}
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
  if (!href) return <code className="block break-all text-sm">{value}</code>

  const url = new URL(href)
  const display = `${url.host}${url.pathname.replace(/\/$/, '')}`
  return (
    <a
      aria-label={value}
      className="block truncate text-sm"
      href={href}
      rel="noreferrer"
      target="_blank"
      title={value}
    >
      {display}
    </a>
  )
}
