import { CloudOff, FileQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import {
  getRegistryEvaluationProgress,
  getRegistryEvaluationStatus,
  loadStats,
  loadRubric,
  loadTeam,
  type RubricBundle,
  type TeamBundle,
  type StatsBundle,
  type RegistryEvaluationStatus,
  type RegistryEvaluationProgress,
} from '@/shared/api'
import { EmptyState } from '@/shared/ui'
import { AreaProfile } from '@/widgets/area-profile'
import { EvaluationMeta } from '@/widgets/evaluation-meta'
import { countFindings, FindingsSummary } from '@/widgets/findings-summary'
import { ScoreSummary } from '@/widgets/score-summary'
import {
  parseFindingsFilter,
  parseTaxonomyPath,
  serializeTaxonomyPath,
  TaxonomyTree,
} from '@/widgets/taxonomy-tree'
import { TeamHeader, teamRankContext } from '@/widgets/team-header'
import { EvaluationProgressView } from '@/widgets/evaluation-progress'
import { TeamSkeleton } from './team-skeleton'

/**
 * Страница команды (спека 006). Композиция и значения — `design/reference/screens/04-06-team-*
 * .html`. Состояния — FR-020: `loading` (скелетон страницы на время асинхронной загрузки отдельного
 * чанка), `missing`
 * (команды нет в бандле), `error` (сбой чтения бандла).
 */

type PageState = 'loading' | 'ready' | 'pending' | 'missing' | 'error'

export function TeamPage() {
  const { teamId } = useParams()
  const [state, setState] = useState<PageState>('loading')
  const [team, setTeam] = useState<TeamBundle | null>(null)
  const [rubrics, setRubrics] = useState<Record<string, RubricBundle>>({})
  const [stats, setStats] = useState<StatsBundle | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [liveStatus, setLiveStatus] = useState<RegistryEvaluationStatus | null>(null)
  const [progress, setProgress] = useState<RegistryEvaluationProgress | null>(null)
  const [pollError, setPollError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  // Переход по prev/next (005-стиль ссылок) меняет :teamId без размонтирования страницы — состояние
  // сбрасывается во время рендера (react.dev: «Adjusting state when a prop changes»), не в эффекте,
  // чтобы не вызывать setState синхронно в теле эффекта.
  const [renderedForTeamId, setRenderedForTeamId] = useState(teamId)
  if (teamId !== renderedForTeamId) {
    setRenderedForTeamId(teamId)
    setState('loading')
    setTeam(null)
    setLiveStatus(null)
    setProgress(null)
    setPollError(false)
  }

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    let delay = 1000
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      let currentStatus: RegistryEvaluationStatus | null = null
      try {
        const nextProgress = await getRegistryEvaluationProgress(teamId)
        if (cancelled) return
        setProgress(nextProgress)
        setLiveStatus(nextProgress.status)
        setPollError(false)
        currentStatus = nextProgress.status
        delay = nextProgress.status === 'running' ? 1000 : 5000
      } catch {
        setPollError(true)
        try {
          const status = await getRegistryEvaluationStatus(teamId)
          if (!cancelled && status) {
            setLiveStatus(status)
            currentStatus = status
          }
        } catch {
          // Keep the last successful snapshot while the polling request is unavailable.
        }
      }
      if (cancelled) return
      const [loadedTeam, backend, frontend, loadedStats] = await Promise.allSettled([
        loadTeam(teamId),
        loadRubric('backend.v1'),
        loadRubric('frontend.v1'),
        loadStats(),
      ])
      if (cancelled) return
      if (loadedTeam.status === 'fulfilled') {
        setTeam(loadedTeam.value)
        setState('ready')
      } else {
        setState((current) => {
          if (currentStatus == null) return current === 'loading' ? 'missing' : current
          if (
            currentStatus === 'running' ||
            currentStatus === 'no_data' ||
            currentStatus === 'failed'
          ) {
            return 'pending'
          }
          return current === 'ready' ? current : 'missing'
        })
      }
      if (backend.status === 'fulfilled')
        setRubrics((current) => ({ ...current, backend: backend.value }))
      if (frontend.status === 'fulfilled')
        setRubrics((current) => ({ ...current, frontend: frontend.value }))
      if (loadedStats.status === 'fulfilled') setStats(loadedStats.value)
    }
    const poll = async () => {
      await refresh()
      if (!cancelled) timer = setTimeout(() => void poll(), delay)
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [teamId, retryKey])

  const retry = () => {
    setState('loading')
    setRetryKey((key) => key + 1)
  }

  const path = parseTaxonomyPath(searchParams)
  const findingsFilter = parseFindingsFilter(searchParams)

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  if (!teamId || state === 'loading') {
    return <TeamSkeleton />
  }

  if (state === 'pending') {
    return (
      <main className="mx-auto max-w-[960px] space-y-[18px] p-4 sm:p-6" aria-live="polite">
        <header className="border-b border-line pb-4">
          <p className="mb-1 text-sm text-fg-muted">Команда</p>
          <h1 className="m-0 break-all text-h1">{teamId}</h1>
          <p className="mb-0 mt-2 text-sm text-fg-muted">
            {progress?.status === 'failed'
              ? 'Проверка прервана'
              : progress?.status === 'no_data'
                ? 'В очереди на проверку'
                : 'Проверка выполняется'}
          </p>
        </header>
        {progress ? (
          <>
            <EvaluationProgressView progress={progress} />
            {pollError ? (
              <p role="status" className="text-sm text-fg-muted">
                Не удалось обновить ход оценки. Последние подтверждённые данные сохранены.
              </p>
            ) : null}
          </>
        ) : pollError ? (
          <p
            role="status"
            className="rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted"
          >
            Не удалось обновить ход оценки. Повторяем запрос…
          </p>
        ) : (
          <p
            role="status"
            className="rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted"
          >
            Получаем структуру репозитория…
          </p>
        )}
      </main>
    )
  }

  if (state === 'missing' || !team) {
    return (
      <main className="mx-auto max-w-[1600px] p-6">
        <EmptyState
          icon={FileQuestion}
          title="Команда не найдена"
          description="Такой команды нет в текущем дата-бандле — возможно, ссылка устарела."
        />
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="mx-auto max-w-[1600px] p-6">
        <EmptyState
          icon={CloudOff}
          title="Не удалось загрузить данные команды"
          description="Попробуйте ещё раз."
          action={{ label: 'Повторить', onClick: retry }}
        />
      </main>
    )
  }

  const areaEntries = Object.entries(team.areas) as [
    'backend' | 'frontend',
    TeamBundle['areas'][string],
  ][]
  const doneAreas = areaEntries.filter(([, area]) => area.status === 'done')
  const displayTeam: TeamBundle =
    liveStatus === 'running' ? { ...team, status: 'running', total: null, partial: true } : team
  const rankContext = teamRankContext(team.team_id)

  return (
    <main className="mx-auto max-w-[1600px] space-y-[18px] p-4 sm:p-6">
      <TeamHeader
        team={displayTeam}
        rankContext={liveStatus === 'running' ? { ...rankContext, rank: null } : rankContext}
      />
      {progress &&
      (liveStatus === 'running' ||
        liveStatus === 'failed' ||
        progress.areas.some((area) => area.status === 'failed')) ? (
        <>
          <EvaluationProgressView progress={progress} />
          {pollError ? (
            <p role="status" className="text-sm text-fg-muted">
              Не удалось обновить ход оценки. Последние подтверждённые данные сохранены.
            </p>
          ) : null}
        </>
      ) : null}
      {doneAreas.length === 0 ? (
        liveStatus === 'running' || liveStatus === 'failed' ? (
          <div className="rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted">
            {liveStatus === 'failed'
              ? 'Оценка остановилась до публикации отчёта. Сохранённые события доступны выше.'
              : 'Результаты появятся здесь после публикации первой области.'}
          </div>
        ) : (
          <EmptyState
            icon={FileQuestion}
            title="Оценка недоступна"
            description="Ни одна область не оценена — данных для профиля и разбора пока нет."
          />
        )
      ) : (
        <>
          <ScoreSummary team={displayTeam} />

          {doneAreas.map(([areaName, area]) => {
            const findingCounts = countFindings(area)
            const areaStats = stats?.areas.find((item) => item.area === areaName)
            return (
              <div key={areaName} className="flex flex-col gap-[18px]">
                <AreaProfile areaName={areaName} area={area} stats={areaStats} />
                <FindingsSummary
                  counts={findingCounts}
                  activeSeverity={findingsFilter.severity}
                  onSeverityChange={(severity) =>
                    updateParams({ severity: severity === 'all' ? null : severity })
                  }
                />
                <TaxonomyTree
                  areaName={areaName}
                  area={area}
                  rubric={rubrics[areaName]}
                  path={path}
                  onPathChange={(next) => updateParams(serializeTaxonomyPath(next))}
                  findingsFilter={findingsFilter}
                  commitSha={team.commit_sha}
                />
              </div>
            )
          })}
        </>
      )}

      <EvaluationMeta team={team} />
    </main>
  )
}
