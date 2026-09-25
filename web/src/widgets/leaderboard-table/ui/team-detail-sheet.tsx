import { ArrowUpRight, CircleDashed, X, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import { TeamStatusBadge, TeamWarningBadges } from '@/entities/team'
import type { LeaderboardTeam, TeamBundle } from '@/shared/api'

interface TeamDetailSheetProps {
  summary: LeaderboardTeam | null
  team: TeamBundle | null
  isLoading: boolean
  onClose: () => void
}

export function TeamDetailSheet({ summary, team, isLoading, onClose }: TeamDetailSheetProps) {
  useEffect(() => {
    if (!summary) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, summary])

  if (!summary) return null

  const findings = team
    ? Object.values(team.areas).flatMap((area) =>
        area.categories.flatMap((category) =>
          category.subcategories.flatMap((subcategory) =>
            subcategory.metrics.flatMap((metric) => metric.findings),
          ),
        ),
      )
    : []

  return (
    <div
      className="sheet-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-label={`Быстрый просмотр ${summary.name}`}
        aria-modal="true"
        className="sheet-panel"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-overline m-0 text-fg-muted uppercase">Быстрый просмотр</p>
            <h2 className="mt-1 text-h2 m-0">{summary.name}</h2>
          </div>
          <button
            type="button"
            aria-label="Закрыть быстрый просмотр"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-fg-muted hover:bg-muted-surface hover:text-fg"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="m-0 text-sm text-fg-muted">Итоговая оценка</p>
              <p className="m-0 mt-1 text-score-large">
                {summary.total?.toFixed(1) ?? '—'}
                <span className="text-lg text-fg-muted"> / 10</span>
              </p>
            </div>
            <TeamStatusBadge status={summary.status} partial={summary.partial} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4">
            {(['backend', 'frontend'] as const).map((area) => (
              <div key={area}>
                <p className="m-0 text-xs uppercase text-fg-muted">{area}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-medium">
                    {summary.areas?.[area]?.toFixed(1) ?? '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 text-strong">Сигналы проверки</h3>
              <span className="text-sm text-fg-muted">{findings.length || 'Нет'} находок</span>
            </div>
            {summary.warnings?.length ? (
              <TeamWarningBadges warnings={summary.warnings} className="mt-3" />
            ) : (
              <p className="mt-3 text-sm text-fg-muted">Критичных сигналов нет.</p>
            )}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="m-0 text-strong">Последняя проверка</h3>
            {isLoading ? (
              <p className="mt-2 text-sm text-fg-muted">Загружаем детали проверки…</p>
            ) : team ? (
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-fg-muted">Коммит</dt>
                <dd className="m-0 break-all font-mono text-xs">{team.commit_sha ?? '—'}</dd>
                <dt className="text-fg-muted">Обновлено</dt>
                <dd className="m-0">
                  {team.meta?.evaluated_at
                    ? new Date(team.meta.evaluated_at).toLocaleString('ru-RU')
                    : '—'}
                </dd>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-fg-muted">Подробный отчёт ещё не опубликован.</p>
            )}
          </div>
        </div>

        <footer className="border-t border-line px-5 py-4">
          {summary.status === 'done' || summary.status === 'running' ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground no-underline transition-transform active:scale-[0.96]"
              to={`/team/${encodeURIComponent(summary.team_id)}`}
              onClick={onClose}
            >
              {summary.status === 'running' ? 'Смотреть ход оценки' : 'Открыть полный отчёт'}
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-sm text-fg-muted">
              {summary.status === 'failed' ? (
                <XCircle size={16} className="text-sev-critical-fg" />
              ) : (
                <CircleDashed size={16} />
              )}
              {summary.status === 'failed'
                ? 'Проверка завершилась с ошибкой.'
                : 'Проверка ещё не запускалась.'}
            </div>
          )}
        </footer>
      </aside>
    </div>
  )
}
