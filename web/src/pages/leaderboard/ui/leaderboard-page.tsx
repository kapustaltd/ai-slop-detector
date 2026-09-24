import { BarChart3, CloudOff, SearchX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { getLeaderboardIndex, loadLeaderboardIndex, type LeaderboardIndexStub } from '@/shared/api'
import { formatTeamCount, SCORE_SCALE_LEGEND } from '@/shared/lib'
import { EmptyState } from '@/shared/ui'
import { LeaderboardSkeleton } from './leaderboard-skeleton'
import {
  LeaderboardRowCard,
  LeaderboardTable,
  LeaderboardToolbar,
  useLeaderboardState,
} from '@/widgets/leaderboard-table'

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

  const resetFilters = () => onFiltersChange({ status: 'all', warningsOnly: false })

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

  const builtAt = index.meta?.built_at ?? index.built_at

  return (
    <main className="mx-auto max-w-[1600px] space-y-[18px] p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Рейтинг команд</h1>
          <p className="text-[13.5px] text-fg-subtle">{formatTeamCount(total)}</p>
        </div>
        <p className="text-[14px] text-fg-muted">
          Данные собраны {new Date(builtAt).toLocaleString('ru-RU')}
        </p>
      </header>

      {loadFailed ? (
        <p role="status" className="text-sm text-warn-fg">
          Не удалось обновить рейтинг. Показываем последние загруженные данные.
        </p>
      ) : null}

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
              <LeaderboardTable teams={teams} sort={sort} onSort={onSort} />
              <div className="flex flex-col gap-2 xl:hidden">
                {teams.map((team) => (
                  <LeaderboardRowCard key={team.team_id} team={team} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {teams.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-[13.5px] text-fg-subtle">
          <ScoreScaleLegend />
        </div>
      ) : null}
    </main>
  )
}

function ScoreScaleLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span>Шкала оценки</span>
      {SCORE_SCALE_LEGEND.map((step) => (
        <span key={step.level} className="flex items-center gap-[5px] text-fg-muted">
          <span
            aria-hidden="true"
            className="block h-[6px] w-[18px] rounded-[3px]"
            style={{ background: step.colorVar }}
          />
          {step.rangeLabel}
        </span>
      ))}
      <span className="flex items-center gap-[5px]">
        <span
          aria-hidden="true"
          className="block h-[6px] w-[18px] rounded-[3px] border border-dashed border-line-strong"
        />
        нет данных
      </span>
    </div>
  )
}
