import { ArrowUpRight, Check, CloudOff, FileQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'

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
import { EmptyState, SectionLink } from '@/shared/ui'
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
  const { hash } = useLocation()
  const [state, setState] = useState<PageState>('loading')
  const [team, setTeam] = useState<TeamBundle | null>(null)
  const [rubrics, setRubrics] = useState<Record<string, RubricBundle>>({})
  const [stats, setStats] = useState<StatsBundle | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [liveStatus, setLiveStatus] = useState<RegistryEvaluationStatus | null>(null)
  const [progress, setProgress] = useState<RegistryEvaluationProgress | null>(null)
  const [pollError, setPollError] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (state !== 'ready' || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, state])

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
    setLastUpdatedAt(null)
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
        setLastUpdatedAt(Date.now())
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
    if (!progress) setState('loading')
    setPollError(false)
    setRetryKey((key) => key + 1)
  }

  const progressRefresh = {
    unavailable: pollError,
    lastUpdatedAt,
    onRetry: retry,
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
      <main className="dashboard-page max-w-[1080px] space-y-8">
        <header className="pb-4">
          <p className="mb-1 text-sm text-fg-muted">Команда</p>
          <h1 className="m-0 break-all text-[32px]/[1.1] font-semibold tracking-[-0.04em]">
            {teamId}
          </h1>
          <p className="mb-0 mt-2 text-sm text-fg-muted">
            {progress?.status === 'failed'
              ? 'Проверка прервана'
              : progress?.status === 'no_data'
                ? 'В очереди на проверку'
                : 'Проверка выполняется'}
          </p>
        </header>
        {progress ? (
          <EvaluationProgressView progress={progress} refresh={progressRefresh} />
        ) : pollError ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-surface p-4 text-sm text-fg-muted"
          >
            <span>Обновления недоступны. Последние данные ещё не получены.</span>
            <button
              type="button"
              className="min-h-10 rounded-control px-3 font-medium text-link underline underline-offset-4"
              onClick={retry}
            >
              Повторить
            </button>
          </div>
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
      <main className="dashboard-page">
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
      <main className="dashboard-page">
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
  const areaFromHash = hash.match(/^#(?:area|rubric)-(backend|frontend)(?:-|$)/)?.[1]
  const activeAreaName =
    doneAreas.find(([areaName]) => areaName === areaFromHash)?.[0] ??
    doneAreas.find(([areaName]) => areaName === path.area)?.[0] ??
    doneAreas[0]?.[0]
  const activeArea = doneAreas.find(([areaName]) => areaName === activeAreaName)
  const displayTeam: TeamBundle =
    liveStatus === 'running' ? { ...team, status: 'running', total: null, partial: true } : team
  const rankContext = teamRankContext(team.team_id)

  return (
    <main className="dashboard-page space-y-6">
      <TeamHeader
        team={displayTeam}
        rankContext={liveStatus === 'running' ? { ...rankContext, rank: null } : rankContext}
      />
      {progress &&
      (liveStatus === 'running' ||
        liveStatus === 'failed' ||
        progress.areas.some((area) => area.status === 'failed')) ? (
        <>
          <EvaluationProgressView progress={progress} refresh={progressRefresh} />
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

          <div className="grid items-start gap-6 xl:grid-cols-2" aria-label="Обзор областей">
            {doneAreas.map(([areaName, area]) => {
              const findingCounts = countFindings(area)
              const areaStats = stats?.areas.find((item) => item.area === areaName)
              return (
                <section
                  key={areaName}
                  className="min-w-0 space-y-4"
                  aria-label={`Обзор · ${areaName}`}
                >
                  <div className="pb-3">
                    <h2 className="m-0 text-[22px] font-medium tracking-[-0.03em]">
                      {areaName === 'backend' ? 'Backend' : 'Frontend'}
                    </h2>
                  </div>
                  <AreaAssessment areaName={areaName} area={area} />
                  <AreaProfile areaName={areaName} area={area} stats={areaStats} />
                  <FindingsSummary
                    counts={findingCounts}
                    activeSeverity={findingsFilter.severity}
                    onSeverityChange={(severity) =>
                      updateParams({ severity: severity === 'all' ? null : severity })
                    }
                  />
                </section>
              )
            })}
          </div>

          {activeArea ? (
            <section className="space-y-4 pt-6" aria-label="Подробный разбор">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-[22px] font-medium tracking-[-0.03em]">
                    Подробный разбор
                  </h2>
                </div>
                {doneAreas.length > 1 ? (
                  <nav
                    aria-label="Область подробного разбора"
                    className="flex rounded-control border border-line bg-surface p-1"
                  >
                    {doneAreas.map(([areaName]) => (
                      <SectionLink
                        key={areaName}
                        target={`rubric-${areaName}`}
                        aria-current={activeAreaName === areaName ? 'location' : undefined}
                        className={`flex min-h-10 items-center rounded-[6px] px-4 text-[14px] font-medium transition-colors ${
                          activeAreaName === areaName
                            ? 'bg-muted-surface text-fg'
                            : 'text-fg-muted hover:bg-muted-surface hover:text-fg'
                        }`}
                      >
                        {areaName === 'backend' ? 'Backend' : 'Frontend'}
                      </SectionLink>
                    ))}
                  </nav>
                ) : null}
              </div>
              <div id={`rubric-${activeArea[0]}`}>
                <TaxonomyTree
                  areaName={activeArea[0]}
                  area={activeArea[1]}
                  rubric={rubrics[activeArea[0]]}
                  path={path}
                  onPathChange={(next) => updateParams(serializeTaxonomyPath(next))}
                  findingsFilter={findingsFilter}
                  commitSha={team.commit_sha}
                />
              </div>
            </section>
          ) : null}
        </>
      )}

      <EvaluationMeta team={team} />
    </main>
  )
}

const SEVERITY_WEIGHT = { info: 0, minor: 1, major: 2, critical: 3 } as const

function issueFindings(category: TeamBundle['areas'][string]['categories'][number]) {
  return category.subcategories
    .flatMap((subcategory) => subcategory.metrics)
    .flatMap((metric) => metric.findings)
    .filter((finding) => finding.kind === 'issue')
}

function severityLabel(severity: keyof typeof SEVERITY_WEIGHT): string {
  return { critical: 'Критичная', major: 'Серьёзная', minor: 'Небольшая', info: 'Информационная' }[
    severity
  ]
}

function categoryCountLabel(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'категория'
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'категории'
  }
  return 'категорий'
}

function AreaAssessment({
  areaName,
  area,
}: {
  areaName: string
  area: TeamBundle['areas'][string]
}) {
  const categories = area.categories
  const strongCategories = [...categories]
    .filter((category) => category.score >= 7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const priorityCategories = [...categories]
    .map((category) => ({ category, issues: issueFindings(category) }))
    .filter(({ issues }) => issues.length > 0)
    .sort((a, b) => {
      const severityDelta =
        Math.max(...b.issues.map((finding) => SEVERITY_WEIGHT[finding.severity])) -
        Math.max(...a.issues.map((finding) => SEVERITY_WEIGHT[finding.severity]))
      return severityDelta || a.category.score - b.category.score
    })
    .slice(0, 3)

  return (
    <section
      aria-label={`Что влияет на результат: ${areaName}`}
      className="dashboard-assessment dashboard-fade"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="m-0 text-[19px] font-medium tracking-[-0.02em]">
            Что влияет на результат
          </h2>
        </div>
        <span className="text-[13.5px] text-fg-muted">
          {area.categories.length} {categoryCountLabel(area.categories.length)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="dashboard-assessment-column" aria-label="Сильные стороны">
          <h3 className="m-0 flex items-center gap-2 text-[15px] font-medium">
            <Check aria-hidden="true" size={16} className="text-sev-strength-fg" />
            Сильные стороны
          </h3>
          {strongCategories.length > 0 ? (
            <ul className="mt-2.5 grid list-none gap-2 p-0">
              {strongCategories.map((category) => (
                <li key={category.id}>
                  <SectionLink
                    target={`area-${areaName}-category-${category.id}`}
                    className="dashboard-assessment-link"
                  >
                    <span>
                      <span className="font-medium text-fg">{category.name}</span>
                      <span className="block text-[13.5px] text-fg-muted">
                        {category.score.toFixed(1)} из 10
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </SectionLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-2.5 text-[14px] leading-5 text-fg-muted">
              Сильных категорий пока нет.
            </p>
          )}
        </section>

        <section className="dashboard-assessment-column" aria-label="Приоритеты улучшения">
          <h3 className="m-0 flex items-center gap-2 text-[15px] font-medium">
            <ArrowUpRight aria-hidden="true" size={16} className="text-sev-major-fg" />
            Приоритеты улучшения
          </h3>
          {priorityCategories.length > 0 ? (
            <ul className="mt-2.5 grid list-none gap-2 p-0">
              {priorityCategories.map(({ category, issues }) => {
                const primaryFinding = [...issues].sort(
                  (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
                )[0]
                return (
                  <li key={category.id}>
                    <SectionLink
                      target={`area-${areaName}-category-${category.id}`}
                      className="dashboard-assessment-link"
                    >
                      <span>
                        <span className="font-medium text-fg">{category.name}</span>
                        <span className="block text-[13.5px] text-fg-muted">
                          {severityLabel(primaryFinding.severity)} находка · {primaryFinding.title}
                        </span>
                      </span>
                      <ArrowUpRight aria-hidden="true" size={14} />
                    </SectionLink>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="m-0 mt-2.5 text-[14px] leading-5 text-fg-muted">
              Серьёзных проблем здесь не нашли.
            </p>
          )}
        </section>
      </div>
    </section>
  )
}
