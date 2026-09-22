import { BarChart3, ChartSpline, CloudOff, SearchX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { getLeaderboardIndex, loadLeaderboardIndex, type LeaderboardIndexStub } from '@/shared/api'
import { SCORE_SCALE_LEGEND } from '@/shared/lib'
import { EmptyState } from '@/shared/ui'
import { DisclaimerBanner } from '@/widgets/disclaimer-banner'
import {
  LeaderboardRowCard,
  LeaderboardTable,
  LeaderboardToolbar,
  useLeaderboardState,
} from '@/widgets/leaderboard-table'

/**
 * Главная — рейтинг команд (спека 005). Композиция и значения —
 * `design/reference/screens/01-03-leaderboard-*.html`. Индекс читается синхронно (бандл уже в
 * основном чанке), поэтому реального состояния «загрузка» на первом кадре нет (research.md) —
 * `isLoading` используется только веткой повторного чтения после ошибки.
 */

function readIndex() {
  try {
    return getLeaderboardIndex()
  } catch {
    return null
  }
}

export function LeaderboardPage() {
  const [index, setIndex] = useState<LeaderboardIndexStub | null>(readIndex)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadLeaderboardIndex()
      .then((freshIndex) => {
        if (!cancelled) setIndex(freshIndex)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
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
      <main className="mx-auto max-w-[1200px] p-6">
        <EmptyState
          icon={CloudOff}
          title="Не удалось загрузить дата-бандл"
          description="Проверьте, что пайплайн собрал web/data/index.json, и попробуйте ещё раз."
          action={{ label: isLoading ? 'Повтор…' : 'Повторить', onClick: () => void retry() }}
        />
      </main>
    )
  }

  if (!index) return null

  const builtAt = index.meta?.built_at ?? index.built_at

  return (
    <main className="mx-auto max-w-[1200px] space-y-[18px] p-4 sm:p-6">
      {/* pr-* резервирует место под фиксированную кнопку темы (ThemeProvider) — иначе на
          некоторых ширинах она перекрывает текст справа (найдено визуальной проверкой FR-015). */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pr-[52px] pb-4 md:pr-[46px]">
        <div className="flex items-center gap-3">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-control bg-brand-soft text-brand">
            <ChartSpline aria-hidden="true" size={17} strokeWidth={1.9} />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[14.5px] font-semibold tracking-[-0.01em]">
              Автооценка качества кода
            </h1>
            <p className="text-[11.5px] text-fg-subtle">
              {total} {total === 1 ? 'команда' : 'команд'}
            </p>
          </div>
          <span className="ml-1 hidden rounded-badge border border-line bg-muted-surface px-2 py-[3px] text-[10.5px] tracking-[0.03em] text-fg-muted uppercase sm:inline-flex">
            внутренний инструмент жюри
          </span>
        </div>
        <p className="text-[12px] text-fg-muted">
          Данные собраны {new Date(builtAt).toLocaleString('ru-RU')}
        </p>
      </header>

      <DisclaimerBanner />

      {total === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Оценок пока нет"
          description="Конвейер ещё не отработал ни по одной команде. Страница обновится, когда появится первый набор файлов — перезагружать вручную не нужно."
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
              <div className="flex flex-col gap-2 md:hidden">
                {teams.map((team) => (
                  <LeaderboardRowCard key={team.team_id} team={team} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {teams.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-fg-subtle">
          <ScoreScaleLegend />
          <span>
            Ранг присваивается по итоговому баллу; одинаковые баллы делят одно место (знак{' '}
            <span className="text-fg-muted">=</span>).
          </span>
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
