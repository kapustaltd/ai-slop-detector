import { ArrowRight, Check, MoreHorizontal, Plus, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  checkRegistryApi,
  createRegistryTeam,
  deleteRegistryTeam,
  getRegistryEvaluationStatuses,
  getRegistryTeams,
  RegistryApiError,
  retryRegistryEvaluation,
  updateRegistryTeam,
  type RegistryEvaluationStatus,
  type RegistryTeam,
} from '@/shared/api'
import { Skeleton, useDialogFocus } from '@/shared/ui'

type TeamDraft = Pick<RegistryTeam, 'id' | 'name' | 'repo' | 'branch' | 'active'>

const emptyTeam: TeamDraft = { id: '', name: '', repo: '', branch: 'main', active: true }

export function TeamManagementPage() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<RegistryTeam[]>([])
  const [draft, setDraft] = useState<TeamDraft | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [step, setStep] = useState<'repo' | 'details' | 'review'>('repo')
  const [isChecking, setIsChecking] = useState(false)
  const [editing, setEditing] = useState<RegistryTeam | null>(null)
  const [deleting, setDeleting] = useState<RegistryTeam | null>(null)
  const [retryingTeamId, setRetryingTeamId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RegistryEvaluationStatus>>({})
  const createDialogRef = useRef<HTMLDivElement>(null)
  const editDialogRef = useRef<HTMLFormElement>(null)
  const deleteDialogRef = useRef<HTMLElement>(null)

  useDialogFocus(createDialogRef, draft !== null, () => {
    if (isSaving) return
    setDraft(null)
    setError('')
    setStep('repo')
  })
  useDialogFocus(editDialogRef, editing !== null, () => {
    if (isSaving) return
    setEditing(null)
    setError('')
  })
  useDialogFocus(deleteDialogRef, deleting !== null, () => {
    if (isSaving) return
    setDeleting(null)
    setError('')
  })

  const checkRepository = async () => {
    if (!draft || isChecking) return
    const rawRepo = draft.repo.trim()
    if (rawRepo !== draft.repo) {
      setDraft((current) => (current ? { ...current, repo: rawRepo } : current))
    }
    if (!rawRepo) {
      setError('Укажите ссылку на репозиторий')
      return
    }
    const parsed = parseRepositoryUrl(rawRepo)
    if (!parsed.repo) {
      setError(parsed.error ?? 'Укажите ссылку вида https://github.com/owner/repository.')
      return
    }
    const parts = parsed.parts
    const repo = parsed.repo
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
    } catch (cause) {
      setError(repositoryCheckError(cause))
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
    const nextEditing = normaliseTeamDraft(editing)
    const validationError = validateTeamDraft(nextEditing)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSaving(true)
    setError('')
    try {
      await updateRegistryTeam(nextEditing)
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
      setDeleting(null)
      await loadTeams()
      setNotice('Команда удалена из реестра.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось удалить команду')
    } finally {
      setIsSaving(false)
    }
  }

  const retryEvaluation = async (team: RegistryTeam) => {
    if (retryingTeamId) return
    setRetryingTeamId(team.id)
    setError('')
    setNotice('')
    try {
      await retryRegistryEvaluation(team.id)
      setStatuses((current) => ({ ...current, [team.id]: 'running' }))
      setNotice(`Повторный анализ команды ${team.name} запущен.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось повторить анализ')
    } finally {
      setRetryingTeamId(null)
    }
  }

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft) return
    const nextDraft = normaliseTeamDraft(draft)
    const validationError = validateTeamDraft(nextDraft)
    if (validationError) {
      setError(validationError)
      return
    }
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      await createRegistryTeam(nextDraft)
      setDraft(null)
      setStep('repo')
      navigate(`/team/${encodeURIComponent(nextDraft.id)}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить команду')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="dashboard-page max-w-[1040px] space-y-4">
      <header className="dashboard-page-header">
        <div>
          <p className="dashboard-kicker">РЕЕСТР</p>
          <h1 className="dashboard-page-title">Команды</h1>
          <p className="dashboard-page-subtitle">Реестр команд и запуск новых проверок.</p>
        </div>
        {apiAvailable ? (
          <button
            className="dashboard-action-button"
            disabled={draft !== null || editing !== null || deleting !== null || isSaving}
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

      {error && !draft && !editing && !deleting ? (
        <div
          role="alert"
          className="rounded-panel border border-warn-border bg-warn-bg p-4 text-sm text-warn-fg"
        >
          {error}
        </div>
      ) : null}

      {draft ? (
        <div
          className="sheet-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving && !hasDraftValues(draft)) {
              setDraft(null)
              setError('')
              setStep('repo')
            }
          }}
        >
          <div
            className="sheet-panel sheet-wide sheet-create-panel"
            ref={createDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-team-title"
          >
            <TeamForm
              draft={draft}
              isSaving={isSaving}
              isChecking={isChecking}
              step={step}
              error={error}
              onStep={setStep}
              onError={setError}
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
        <div
          className="sheet-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setEditing(null)
              setError('')
            }
          }}
        >
          <form
            ref={editDialogRef}
            aria-label={`Изменение команды ${editing.name}`}
            aria-describedby={error ? 'edit-team-error' : undefined}
            className="sheet-panel sheet-wide gap-4 overflow-y-auto p-5"
            role="dialog"
            aria-modal="true"
            onSubmit={(event) => void saveEdit(event)}
          >
            <div>
              <h2 id="edit-team-title" className="m-0 text-lg font-semibold">
                Изменить команду {editing.name}
              </h2>
              <p className="m-0 mt-1 text-sm text-fg-muted">ID {editing.id} останется прежним.</p>
            </div>
            {error ? (
              <p
                id="edit-team-error"
                role="alert"
                className="rounded-control bg-warn-bg p-3 text-sm text-warn-fg"
              >
                {error}
              </p>
            ) : null}
            <div className="grid gap-3">
              <label className="text-sm">
                Название
                <input
                  className="mt-1 block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3"
                  maxLength={120}
                  required
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </label>
              <label className="text-sm">
                Репозиторий
                <input
                  className="mt-1 block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3"
                  maxLength={240}
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
                  maxLength={120}
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
        <div
          className="sheet-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setDeleting(null)
              setError('')
            }
          }}
        >
          <section
            aria-label={`Удаление команды ${deleting.name}`}
            aria-describedby="delete-team-description"
            className="sheet-panel sheet-wide h-auto self-end gap-3 border-t p-5 sm:mr-5 sm:mb-5 sm:h-auto sm:max-h-[320px] sm:self-end sm:rounded-panel"
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
          >
            <h2 id="delete-team-title" className="m-0 text-lg font-semibold">
              Удалить команду {deleting.name}?
            </h2>
            <p id="delete-team-description" className="m-0 text-sm">
              Запись исчезнет из реестра и текущего рейтинга. Сохранённые отчёты останутся на
              сервере.
            </p>
            {error ? (
              <p role="alert" className="rounded-control bg-warn-bg p-3 text-sm text-warn-fg">
                {error}
              </p>
            ) : null}
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

      {apiAvailable ? (
        <section
          aria-busy={isLoading}
          aria-label="Реестр команд"
          className="dashboard-panel dashboard-registry-panel divide-y divide-line"
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
            <>
              <div className="overflow-x-auto">
                <table className="dashboard-registry-table w-full min-w-[820px] border-collapse text-left text-sm">
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
                        <td data-label="Репозиторий" className="max-w-[22rem] truncate px-4 py-3">
                          <RepositoryLink value={team.repo} />
                        </td>
                        <td data-label="Ветка" className="px-4 py-3">
                          <code>{team.branch}</code>
                        </td>
                        <td data-label="Оценка" className="px-4 py-3">
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
                        <td data-label="Действия" className="px-4 py-3">
                          <TeamActionsMenu
                            team={team}
                            canRetry={statuses[team.id] === 'failed'}
                            isRetrying={retryingTeamId === team.id}
                            onRetry={() => void retryEvaluation(team)}
                            onEdit={() => {
                              setEditing(team)
                              setDeleting(null)
                              setDraft(null)
                              setError('')
                              setNotice('')
                            }}
                            onDelete={() => {
                              setDeleting(team)
                              setEditing(null)
                              setDraft(null)
                              setError('')
                              setNotice('')
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}

function TeamActionsMenu({
  team,
  canRetry,
  isRetrying,
  onRetry,
  onEdit,
  onDelete,
}: {
  team: RegistryTeam
  canRetry: boolean
  isRetrying: boolean
  onRetry: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const triggerRect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const gap = 4
    const viewportPadding = 8
    const opensBelow =
      triggerRect.bottom + gap + menuRect.height <= window.innerHeight - viewportPadding
    const top = opensBelow
      ? triggerRect.bottom + gap
      : Math.max(viewportPadding, triggerRect.top - menuRect.height - gap)
    const left = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuRect.width),
      Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding),
    )

    setPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()

    const reposition = () => updatePosition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return

    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    firstItem?.focus()

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return
      }
      setIsOpen(false)
    }
    const closeOnKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnKeyDown)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnKeyDown)
    }
  }, [isOpen])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    )
    if (items.length === 0) return

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      items[(currentIndex + direction + items.length) % items.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items.at(-1)?.focus()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex min-h-11 items-center gap-1 rounded-control border border-line px-2.5 text-sm text-fg-muted hover:bg-muted-surface"
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreHorizontal aria-hidden="true" size={17} />
        Действия
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              aria-label={`Действия команды ${team.name}`}
              className="fixed z-50 flex min-w-40 flex-col gap-1 rounded-panel border border-line bg-surface p-1 shadow-lg"
              role="menu"
              tabIndex={-1}
              style={{
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
              }}
              onKeyDown={handleMenuKeyDown}
            >
              {canRetry ? (
                <button
                  aria-label={`Повторить анализ ${team.name}`}
                  className="min-h-10 rounded-control px-3 text-left text-sm hover:bg-muted-surface disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRetrying}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    onRetry()
                  }}
                >
                  {isRetrying ? 'Запуск…' : 'Повторить анализ'}
                </button>
              ) : null}
              <button
                aria-label={`Изменить ${team.name}`}
                className="min-h-10 rounded-control px-3 text-left text-sm hover:bg-muted-surface"
                role="menuitem"
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onEdit()
                }}
              >
                Изменить
              </button>
              <button
                aria-label={`Удалить ${team.name}`}
                className="min-h-10 rounded-control px-3 text-left text-sm text-sev-critical-fg hover:bg-sev-critical-bg"
                role="menuitem"
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onDelete()
                }}
              >
                Удалить
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
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
  onError: (error: string) => void
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

function TeamForm({
  draft,
  existingIds,
  isSaving,
  isChecking,
  step,
  error,
  onStep,
  onError,
  onCheck,
  onCancel,
  onChange,
  onSubmit,
}: TeamFormProps) {
  const change = <K extends keyof TeamDraft>(key: K, value: TeamDraft[K]) =>
    onChange({ ...draft, [key]: value })
  const input = 'block min-h-11 w-full rounded-control border border-line-strong bg-bg px-3 text-fg'
  const button =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50'
  const steps = [
    { key: 'repo', label: 'Репозиторий' },
    { key: 'details', label: 'Настройки' },
    { key: 'review', label: 'Подтверждение' },
  ] as const
  const currentStepIndex = steps.findIndex((item) => item.key === step)
  const repository = repositoryParts(draft.repo)
  const description =
    step === 'repo'
      ? 'Сначала добавим репозиторий в новую команду.'
      : step === 'details'
        ? 'Задайте имя, ID и ветку для новой команды.'
        : 'Проверьте, что будет сохранено и проверено.'
  return (
    <section aria-label="Добавление команды" className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-6">
        <div className="min-w-0">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Добавление команды
          </p>
          <h2 id="create-team-title" className="m-0 mt-2 text-xl font-semibold leading-tight">
            Добавить команду
          </h2>
          <p className="m-0 mt-2 max-w-[34rem] text-sm leading-5 text-fg-muted">{description}</p>
        </div>
        <button
          aria-label="Закрыть добавление команды"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-muted-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          title="Закрыть"
          type="button"
          onClick={onCancel}
        >
          <X aria-hidden="true" size={19} strokeWidth={2} />
        </button>
      </header>

      <div className="sheet-form-content min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <ol aria-label="Шаги добавления команды" className="m-0 flex list-none gap-2 p-0">
          {steps.map((item, index) => {
            const isCurrent = item.key === step
            const isComplete = index < currentStepIndex
            return (
              <li key={item.key} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    isCurrent
                      ? 'border-brand bg-brand text-on-accent'
                      : isComplete
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line-strong bg-bg text-fg-muted'
                  }`}
                >
                  {isComplete ? <Check aria-hidden="true" size={14} /> : index + 1}
                </span>
                <span
                  className={`min-w-0 text-xs leading-4 ${isCurrent ? 'font-semibold text-fg' : 'text-fg-muted'}`}
                >
                  {item.label}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={`h-px min-w-2 flex-1 ${index < currentStepIndex ? 'bg-brand' : 'bg-line'}`}
                  />
                ) : null}
              </li>
            )
          })}
        </ol>

        <div key={step} className="sheet-step-transition mt-8">
          {error && step !== 'repo' ? (
            <p role="alert" className="mb-6 rounded-control bg-warn-bg p-3 text-sm text-warn-fg">
              {error}
            </p>
          ) : null}

          {step === 'repo' ? (
            <form
              id="repo-step-form"
              className="space-y-5"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                onCheck()
              }}
            >
              <div>
                <label className="block text-sm font-semibold" htmlFor="repository-url">
                  Ссылка на репозиторий
                </label>
                <input
                  id="repository-url"
                  aria-describedby={error ? 'repository-hint repository-error' : 'repository-hint'}
                  aria-invalid={Boolean(error)}
                  className={`${input} mt-2`}
                  type="url"
                  maxLength={240}
                  placeholder="https://github.com/owner/repository"
                  value={draft.repo}
                  onBlur={(event) => {
                    const value = event.currentTarget.value.trim()
                    if (value !== draft.repo) change('repo', value)
                    if (!value) return
                    const parsed = parseRepositoryUrl(value)
                    onError(parsed.error ?? '')
                  }}
                  onChange={(event) => change('repo', event.target.value)}
                />
                <p id="repository-hint" className="m-0 mt-2 text-sm leading-5 text-fg-muted">
                  Вставьте ссылку на публичный репозиторий GitHub.
                </p>
                {error ? (
                  <p id="repository-error" role="alert" className="m-0 mt-2 text-sm text-warn-fg">
                    {error}
                  </p>
                ) : null}
              </div>
              <p className="m-0 text-sm leading-5 text-fg-muted">
                Мы проверим формат ссылки и убедимся, что репозиторий ещё не добавлен в реестр.
              </p>
            </form>
          ) : null}

          {step === 'details' ? (
            <form
              id="details-step-form"
              className="space-y-6"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                const nextDraft = normaliseTeamDraft(draft)
                const validationError = validateTeamDraft(nextDraft)
                if (validationError) {
                  onError(validationError)
                  return
                }
                if (existingIds.some((id) => id.toLowerCase() === nextDraft.id.toLowerCase())) {
                  onError('Такой ID уже есть в реестре.')
                  return
                }
                onChange(nextDraft)
                onStep('review')
              }}
            >
              <div
                aria-label="Распознанный репозиторий"
                className="rounded-control border border-line bg-muted-surface p-4"
                role="status"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Check aria-hidden="true" className="text-brand" size={16} />
                  Ссылка распознана
                </div>
                <code className="mt-2 block break-all text-sm text-fg">{repository.slug}</code>
                <p className="m-0 mt-2 text-sm leading-5 text-fg-muted">
                  Доступность содержимого проверится при запуске оценки.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Название команды
                  <input
                    className={input}
                    maxLength={120}
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
                    value={draft.id}
                    onChange={(event) => change('id', event.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Ветка
                  <input
                    className={input}
                    maxLength={120}
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
            </form>
          ) : null}

          {step === 'review' ? (
            <div className="space-y-6">
              <div className="rounded-control border border-line bg-bg p-4 text-sm">
                <dl className="m-0 grid gap-3 sm:grid-cols-[9rem_1fr]">
                  <dt className="text-fg-muted">Команда</dt>
                  <dd className="m-0">
                    {draft.name} <code className="text-xs text-fg-muted">{draft.id}</code>
                  </dd>
                  <dt className="text-fg-muted">Репозиторий</dt>
                  <dd className="m-0 break-all">{repository.slug}</dd>
                  <dt className="text-fg-muted">Ветка</dt>
                  <dd className="m-0">{draft.branch}</dd>
                  <dt className="text-fg-muted">Проверка</dt>
                  <dd className="m-0">{draft.active ? 'Запустится сразу' : 'Не запускается'}</dd>
                </dl>
              </div>
              <p className="m-0 text-sm leading-5 text-fg-muted">
                Команда сохранится в реестре. Для активной команды начнётся проверка ветки{' '}
                <code>{draft.branch}</code>.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 py-4">
        <div className="min-w-0">
          {step === 'repo' ? (
            <button
              className="min-h-11 rounded-control px-3 text-sm text-fg-muted transition-colors hover:bg-muted-surface hover:text-fg"
              type="button"
              onClick={onCancel}
            >
              Отмена
            </button>
          ) : (
            <button
              className="min-h-11 rounded-control border border-line-strong px-4 text-sm transition-transform active:scale-[0.96]"
              type="button"
              onClick={() => onStep(step === 'review' ? 'details' : 'repo')}
            >
              Назад
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {step === 'repo' ? (
            <button className={button} disabled={isChecking} form="repo-step-form" type="submit">
              {isChecking ? 'Проверяем…' : 'Продолжить'}
              {!isChecking ? <ArrowRight aria-hidden="true" size={16} /> : null}
            </button>
          ) : null}
          {step === 'details' ? (
            <button className={button} form="details-step-form" type="submit">
              Продолжить <ArrowRight aria-hidden="true" size={16} />
            </button>
          ) : null}
          {step === 'review' ? (
            <form id="review-step-form" onSubmit={onSubmit}>
              <button className={button} disabled={isSaving} type="submit">
                <Check aria-hidden="true" size={16} />
                {isSaving ? 'Сохраняем…' : draft.active ? 'Запустить проверку' : 'Добавить команду'}
              </button>
            </form>
          ) : null}
        </div>
      </footer>
    </section>
  )
}

function parseRepositoryUrl(value: string): {
  repo: string | null
  parts: string[]
  error: string | null
} {
  try {
    const url = new URL(value)
    const parts = url.pathname
      .replace(/\/$/, '')
      .replace(/\.git$/, '')
      .split('/')
      .filter(Boolean)
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      parts.length !== 2 ||
      parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))
    ) {
      return {
        repo: null,
        parts,
        error: 'Укажите ссылку вида https://github.com/owner/repository.',
      }
    }
    return { repo: `https://github.com/${parts.join('/')}`, parts, error: null }
  } catch {
    return {
      repo: null,
      parts: [],
      error: 'Укажите ссылку вида https://github.com/owner/repository.',
    }
  }
}

function repositoryParts(value: string) {
  const parsed = parseRepositoryUrl(value)
  return { slug: parsed.parts.join('/') || value }
}

function repositoryCheckError(cause: unknown) {
  if (cause instanceof RegistryApiError && cause.status === 0) {
    return 'Не удалось проверить реестр. Проверьте соединение и повторите попытку.'
  }
  if (cause instanceof Error) return cause.message
  return 'Репозиторий не найден или недоступен. Повторите попытку.'
}

function hasDraftValues(draft: TeamDraft) {
  return Boolean(
    draft.repo.trim() ||
    draft.name.trim() ||
    draft.id.trim() ||
    draft.branch.trim() !== emptyTeam.branch ||
    draft.active !== emptyTeam.active,
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

function normaliseTeamDraft(team: TeamDraft): TeamDraft {
  return {
    ...team,
    id: team.id.trim(),
    name: team.name.trim(),
    repo: team.repo.trim(),
    branch: team.branch.trim(),
  }
}

function validateTeamDraft(team: TeamDraft) {
  if (!team.name) return 'Укажите название команды.'
  if (!team.branch) return 'Укажите ветку репозитория.'
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(team.id)) {
    return 'ID команды: латинские буквы, цифры, точка, дефис и подчёркивание; первый символ — буква или цифра.'
  }
  return null
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
