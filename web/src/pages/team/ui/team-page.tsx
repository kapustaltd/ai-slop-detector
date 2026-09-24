import { CloudOff, FileQuestion } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'

import {
  getRegistryEvaluationStatus,
  loadStats,
  loadRubric,
  loadTeam,
  type RubricBundle,
  type TeamBundle,
  type StatsBundle,
  type RegistryEvaluationStatus,
} from '@/shared/api'
import { EmptyState } from '@/shared/ui'
import { DisclaimerBanner } from '@/widgets/disclaimer-banner'
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

/**
 * Страница команды (спека 006). Композиция и значения — `design/reference/screens/04-06-team-*
 * .html`. Состояния — FR-020: `loading` (текст, без скелетона — короткий переход, но всё же
 * реальная асинхронная загрузка отдельного чанка, в отличие от синхронного индекса 005), `missing`
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
  }

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    const refresh = async () => {
      let status: RegistryEvaluationStatus | null = null
      try {
        status = await getRegistryEvaluationStatus(teamId)
      } catch {
        /* static mode */
      }
      if (cancelled) return
      setLiveStatus(status)
      try {
        const [loadedTeam, backend, frontend, loadedStats] = await Promise.all([
          loadTeam(teamId),
          loadRubric('backend.v1'),
          loadRubric('frontend.v1'),
          loadStats(),
        ])
        if (cancelled) return
        setTeam(loadedTeam)
        setRubrics({ backend, frontend })
        setStats(loadedStats)
        setState('ready')
      } catch {
        if (!cancelled)
          setState(status === 'running' || status === 'no_data' ? 'pending' : 'missing')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
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
    return (
      <main className="mx-auto max-w-[1600px] p-6" aria-busy="true">
        <p className="text-[15px] text-fg-muted">Загрузка команды…</p>
      </main>
    )
  }

  if (state === 'pending') {
    return (
      <main className="mx-auto max-w-[1600px] p-6" aria-live="polite">
        <h1 className="text-h1">Оценка команды выполняется</h1>
        <p className="text-fg-muted">Готовые области появятся здесь автоматически.</p>
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
      {liveStatus === 'running' ? (
        <p role="status" className="rounded-panel border border-line bg-surface p-4 text-sm">
          Оценка продолжается. Ниже показаны уже опубликованные области; страница обновляется
          автоматически.
        </p>
      ) : null}
      <DisclaimerBanner />

      {doneAreas.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="Оценка недоступна"
          description="Ни одна область не оценена — данных для профиля и разбора пока нет."
        />
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
