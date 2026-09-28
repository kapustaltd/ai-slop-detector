import { BarChart3, CloudOff, Plus, SearchX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  getLeaderboardIndex,
  loadLeaderboardIndex,
  loadTeam,
  type LeaderboardIndexStub,
  type LeaderboardTeam,
  type TeamBundle,
} from '@/shared/api'
import { formatTeamCount } from '@/shared/lib'
import { EmptyState } from '@/shared/ui'
import { LeaderboardSkeleton } from './leaderboard-skeleton'
import {
  LeaderboardRowCard,
  LeaderboardTable,
  LeaderboardToolbar,
  TeamDetailSheet,
  useLeaderboardState,
} from '@/widgets/leaderboard-table'

import { formatLeaderboardSummary } from '../model/summary'

/**
 * Главная — рейтинг команд (спека 005). Композиция и значения —
 * `design/reference/screens/01-03-leaderboard-*.html`. Пока production-индекс читается, skeleton
 * сохраняет форму desktop-таблицы и мобильных карточек.
 */

function readIndex() {
  try {
    return getLeaderboardIndex()
  } catch {
    return null
  }
}

export function LeaderboardPage() {
  const [index, setIndex] = useState<LeaderboardIndexStub | null>(() =>
    import.meta.env.PROD ? null : readIndex(),
  )
  const [loadFailed, setLoadFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<LeaderboardTeam | null>(null)
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<TeamBundle | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsLoadFailed, setDetailsLoadFailed] = useState(false)
  const detailsRequestId = useRef(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      void loadLeaderboardIndex()
        .then((freshIndex) => {
          if (!cancelled) {
            setIndex(freshIndex)
            setLoadFailed(false)
          }
        })
        .catch(() => {
          if (!cancelled) setLoadFailed(true)
        })
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const retry = useCallback(async () => {
    setIsLoading(true)
    try {
      setIndex(await loadLeaderboardIndex())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const { teams, total, sort, filters, onSort, onFiltersChange } = useLeaderboardState(index)

  const selectedTeamIndex = selectedTeam
    ? teams.findIndex((team) => team.team_id === selectedTeam.team_id)
    : -1
  const previousTeam = selectedTeamIndex > 0 ? teams[selectedTeamIndex - 1] : null
  const nextTeam = selectedTeamIndex >= 0 ? (teams[selectedTeamIndex + 1] ?? null) : null

  const resetFilters = () => onFiltersChange({ status: 'all', warningsOnly: false, query: '' })

  const openTeamDetails = async (team: LeaderboardTeam) => {
    const requestId = ++detailsRequestId.current
    setSelectedTeam(team)
    setSelectedTeamDetails(null)
    setDetailsLoadFailed(false)
    setIsLoadingDetails(true)
    try {
      const details = await loadTeam(team.team_id)
      if (requestId === detailsRequestId.current) setSelectedTeamDetails(details)
    } catch {
      if (requestId === detailsRequestId.current) setDetailsLoadFailed(true)
    } finally {
      if (requestId === detailsRequestId.current) setIsLoadingDetails(false)
    }
  }

  if (loadFailed && !index) {
    return (
      <main className="mx-auto max-w-[1600px] p-6">
        <EmptyState
          icon={CloudOff}
          title="Не удалось загрузить дата-бандл"
          description="Проверьте, что пайплайн собрал web/data/index.json, и попробуйте ещё раз."
          action={{ label: isLoading ? 'Повтор…' : 'Повторить', onClick: () => void retry() }}
        />
      </main>
    )
  }

  if (!index) return <LeaderboardSkeleton />

  return (
    <main className="dashboard-page">
      {loadFailed ? (
        <p role="status" className="text-sm text-warn-fg">
          Не удалось обновить рейтинг. Показываем последние загруженные данные.
        </p>
      ) : null}

      <section className="dashboard-ranking-column" aria-labelledby="ranking-section-title">
        <div className="dashboard-ranking-panel">
          <div className="dashboard-panel-heading">
            <div className="flex items-center gap-3">
              <h2 id="ranking-section-title" className="dashboard-panel-title">
                Рейтинг команд
              </h2>
              <span className="dashboard-section-count">{formatTeamCount(total)}</span>
            </div>
          </div>
          <p className="dashboard-ranking-summary">{formatLeaderboardSummary(index.teams)}</p>

          {total === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Рейтинг появится после проверки команд"
              description="Добавьте команды в реестр. Результаты появятся здесь после проверки репозиториев."
            />
          ) : (
            <>
              <LeaderboardToolbar
                filters={filters}
                onFiltersChange={onFiltersChange}
                sort={sort}
                onSort={onSort}
                shown={teams.length}
                total={total}
                action={
                  <Link
                    className="dashboard-action-button dashboard-action-button-secondary"
                    to="/manage/teams"
                  >
                    <Plus aria-hidden="true" size={16} />
                    Добавить команду
                  </Link>
                }
              />

              {teams.length === 0 ? (
                <EmptyState
                  layout="inline"
                  icon={SearchX}
                  title="Под фильтры не попала ни одна команда"
                  description="Попробуйте ослабить условия отбора."
                  action={{ label: 'Сбросить фильтры', onClick: resetFilters }}
                />
              ) : (
                <>
                  <LeaderboardTable
                    teams={teams}
                    sort={sort}
                    onSort={onSort}
                    onSelectTeam={(team) => void openTeamDetails(team)}
                  />
                  <div className="flex flex-col gap-2 px-3 pb-3 xl:hidden">
                    {teams.map((team) => (
                      <LeaderboardRowCard
                        key={team.team_id}
                        team={team}
                        onSelectTeam={() => void openTeamDetails(team)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <TeamDetailSheet
        summary={selectedTeam}
        team={selectedTeamDetails}
        isLoading={isLoadingDetails}
        loadFailed={detailsLoadFailed}
        previousTeam={previousTeam}
        nextTeam={nextTeam}
        onClose={() => {
          detailsRequestId.current += 1
          setSelectedTeam(null)
        }}
        onNavigate={(team) => void openTeamDetails(team)}
        onRetry={() => {
          if (selectedTeam) void openTeamDetails(selectedTeam)
        }}
      />
    </main>
  )
}
