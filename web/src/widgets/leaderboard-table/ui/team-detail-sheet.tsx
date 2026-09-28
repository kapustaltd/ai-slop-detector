import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  Copy,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { LeaderboardTeam, TeamBundle } from '@/shared/api'
import { useDialogFocus } from '@/shared/ui/modal'

import {
  DETAIL_AREA_KEYS,
  DETAIL_AREA_LABELS,
  findingHref,
  formatEvaluationTime,
  getAreaCoverageMessage,
  getAreaScore,
  getDetailInsights,
  getDetailNotes,
  getExecutionStatus,
  getFindingKindCounts,
  getSeverityCounts,
  getTeamFindings,
  SEVERITY_LABELS,
} from '../model/team-detail-sheet'

interface TeamDetailSheetProps {
  summary: LeaderboardTeam | null
  team: TeamBundle | null
  isLoading: boolean
  loadFailed: boolean
  previousTeam: LeaderboardTeam | null
  nextTeam: LeaderboardTeam | null
  onClose: () => void
  onNavigate: (team: LeaderboardTeam) => void
  onRetry: () => void
}

export function TeamDetailSheet({
  summary,
  team,
  isLoading,
  loadFailed,
  previousTeam,
  nextTeam,
  onClose,
  onNavigate,
  onRetry,
}: TeamDetailSheetProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const copyTimer = useRef<number | null>(null)
  const [copiedCommitFor, setCopiedCommitFor] = useState<string | null>(null)

  useDialogFocus(dialogRef, summary !== null, onClose)

  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    },
    [],
  )

  if (!summary) return null

  const copiedCommit = copiedCommitFor === summary.team_id
  const findings = getTeamFindings(team)
  const insights = getDetailInsights(findings)
  const severityCounts = getSeverityCounts(findings)
  const findingKindCounts = getFindingKindCounts(findings)
  const warnings = team?.warnings ?? summary.warnings ?? []
  const partial = team?.partial ?? summary.partial
  const execution = getExecutionStatus(summary.status)
  const completeness = partial
    ? 'Есть ограничения покрытия'
    : summary.status === 'done'
      ? 'Полное покрытие'
      : 'Покрытие ещё не определено'
  const detailNotes = getDetailNotes(summary, team)

  const copyCommit = async () => {
    if (!team?.commit_sha || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(team.commit_sha)
      setCopiedCommitFor(summary.team_id)
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedCommitFor(null), 1800)
    } catch {
      setCopiedCommitFor(null)
    }
  }

  return (
    <div
      className="sheet-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside
        aria-labelledby="team-detail-title"
        aria-modal="true"
        className="sheet-panel"
        ref={dialogRef}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <p className="text-overline m-0 text-fg-muted uppercase">Быстрый просмотр</p>
            <h2 id="team-detail-title" className="mt-1 m-0 overflow-wrap-anywhere text-h2">
              {summary.name}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Предыдущая команда"
              title="Предыдущая команда"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control border border-line px-2 text-fg-muted hover:bg-muted-surface hover:text-fg disabled:pointer-events-none disabled:opacity-35"
              disabled={!previousTeam}
              onClick={() => previousTeam && onNavigate(previousTeam)}
            >
              <ChevronLeft aria-hidden="true" size={18} />
              <span className="sr-only md:inline md:not-sr-only md:text-[12px]">Пред.</span>
            </button>
            <button
              type="button"
              aria-label="Следующая команда"
              title="Следующая команда"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-control border border-line px-2 text-fg-muted hover:bg-muted-surface hover:text-fg disabled:pointer-events-none disabled:opacity-35"
              disabled={!nextTeam}
              onClick={() => nextTeam && onNavigate(nextTeam)}
            >
              <ChevronRight aria-hidden="true" size={18} />
              <span className="sr-only md:inline md:not-sr-only md:text-[12px]">След.</span>
            </button>
            <button
              type="button"
              aria-label="Закрыть быстрый просмотр"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control text-fg-muted hover:bg-muted-surface hover:text-fg"
              onClick={onClose}
            >
              <X aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        <div
          className={`flex-1 overflow-y-auto px-6 py-6 ${team && !isLoading ? 'dashboard-fade' : ''}`}
        >
          <section aria-label="Состояние проверки" className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="m-0 text-sm text-fg-muted">Итоговая оценка</p>
                <p className="m-0 mt-1 text-score-large tabular-nums">
                  {summary.total?.toFixed(1) ?? '—'}
                  <span className="text-lg text-fg-muted"> / 10</span>
                </p>
                {partial ? (
                  <details className="sheet-score-note mt-2">
                    <summary>Оценка с ограничениями</summary>
                    <p>
                      Итог отражает только доступную часть проверки. Смотрите ограничения ниже перед
                      сравнением с другими командами.
                    </p>
                  </details>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 text-left text-[14px] sm:text-right">
                <StatusLine icon={execution.icon} label="Выполнение" value={execution.label} />
                <StatusLine
                  icon={partial ? CircleAlert : Check}
                  label="Полнота"
                  value={completeness}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-line py-4">
              {DETAIL_AREA_KEYS.map((areaName) => {
                const area = team?.areas[areaName]
                const areaMessage = team
                  ? getAreaCoverageMessage(areaName, area, warnings, partial)
                  : partial && getAreaScore(summary, null, areaName) === null
                    ? getAreaCoverageMessage(areaName, area, warnings, partial)
                    : null
                return (
                  <div key={areaName} className="min-w-0">
                    <p className="m-0 text-[13px] uppercase tracking-[0.04em] text-fg-muted">
                      {DETAIL_AREA_LABELS[areaName]}
                    </p>
                    <p className="m-0 mt-1 text-[19px] font-medium tabular-nums">
                      {getAreaScore(summary, team, areaName)?.toFixed(1) ?? '—'}
                    </p>
                    {areaMessage ? (
                      <p className="m-0 mt-1 text-[13px] leading-[1.4] text-warn-fg-body">
                        {areaMessage}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="detail-notes-title" className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="detail-notes-title" className="m-0 text-strong">
                Что важно знать
              </h3>
              {warnings.length === 0 && !partial ? (
                <span className="text-[13px] text-fg-muted">Ограничений нет</span>
              ) : null}
            </div>
            {detailNotes.length > 0 ? (
              <ul className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
                {detailNotes.map((note) => {
                  const Icon = note.icon
                  return (
                    <li key={note.key} className={`sheet-note sheet-note--${note.tone}`}>
                      <Icon aria-hidden="true" size={17} strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="m-0 text-[14.5px] font-medium">{note.title}</p>
                        <p className="m-0 mt-0.5 text-[13.5px] leading-[1.45] text-fg-muted">
                          {note.description}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] text-fg-muted">
                Проверка завершена без ограничений покрытия.
              </p>
            )}
          </section>

          <section aria-labelledby="detail-insights-title" className="mt-8">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="detail-insights-title" className="m-0 text-strong">
                Выводы по отчёту
              </h3>
              {findings.length > 0 ? (
                <span className="text-[13px] text-fg-muted">Доказательства, а не ошибки</span>
              ) : null}
            </div>
            {isLoading ? (
              <p className="mt-3 text-[14px] text-fg-muted">Загружаем выводы из отчёта…</p>
            ) : loadFailed ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="m-0 text-[14px] text-fg-muted">Не удалось загрузить выводы отчёта.</p>
                <button
                  className="min-h-10 rounded-control border border-line-strong px-3 text-sm"
                  type="button"
                  onClick={onRetry}
                >
                  Повторить
                </button>
              </div>
            ) : team && insights.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                {insights.map(({ context, label }) => (
                  <article
                    key={`${label}-${context.finding.file}-${context.finding.line_start}`}
                    className="sheet-insight"
                  >
                    <p className="m-0 text-[13px] font-medium uppercase tracking-[0.04em] text-fg-muted">
                      {label}
                    </p>
                    <h4 className="m-0 mt-1 text-[15px] font-medium">{context.metricName}</h4>
                    <p className="m-0 mt-1 text-[14px] leading-[1.5] text-fg-muted">
                      {context.finding.explanation}
                    </p>
                    <Link
                      className="mt-2 inline-flex min-h-10 items-center gap-1 text-[13.5px] text-link"
                      to={findingHref(summary.team_id, context)}
                    >
                      Открыть раздел отчёта
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </article>
                ))}
              </div>
            ) : team ? (
              <p className="mt-3 text-[14px] text-fg-muted">В отчёте пока нет отдельных выводов.</p>
            ) : null}

            {team && findings.length > 0 ? (
              <div className="mt-5 border-t border-line pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 text-[14px] font-medium">Доказательства по серьёзности</p>
                  <span className="text-[13px] text-fg-muted">
                    {findingKindCounts.strength} сильных сторон · {findingKindCounts.issue} проблем
                  </span>
                </div>
                <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 text-[13.5px] text-fg-muted">
                  {(Object.keys(SEVERITY_LABELS) as Array<keyof typeof SEVERITY_LABELS>).map(
                    (severity) => (
                      <li key={severity} className="flex items-center justify-between gap-2">
                        <span>{SEVERITY_LABELS[severity]}</span>
                        <strong className="font-medium tabular-nums text-fg">
                          {severityCounts[severity]}
                        </strong>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="detail-meta-title" className="mt-8 border-t border-line pt-5">
            <h3 id="detail-meta-title" className="m-0 text-strong">
              Детали проверки
            </h3>
            {isLoading ? (
              <p className="mt-2 text-[14px] text-fg-muted">Загружаем детали…</p>
            ) : loadFailed ? null : team ? (
              <div>
                <dl className="mt-3 flex flex-col gap-3 text-[14px]">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="shrink-0 text-fg-muted">Коммит</dt>
                    <dd className="m-0 flex min-w-0 items-center gap-2">
                      <code className="truncate text-[13px]" title={team.commit_sha ?? undefined}>
                        {team.commit_sha ? `Коммит ${team.commit_sha.slice(0, 7)}` : '—'}
                      </code>
                      {team.commit_sha ? (
                        <button
                          type="button"
                          aria-label="Скопировать полный SHA коммита"
                          className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-control text-fg-muted hover:bg-muted-surface hover:text-fg"
                          onClick={() => void copyCommit()}
                        >
                          <Copy aria-hidden="true" size={15} />
                        </button>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 text-fg-muted">Проверка завершена</dt>
                    <dd className="m-0 text-right">
                      {team.meta?.evaluated_at
                        ? (() => {
                            const time = formatEvaluationTime(team.meta.evaluated_at)
                            return (
                              <details>
                                <summary className="cursor-pointer text-[13.5px]">
                                  {time.value}
                                </summary>
                                <p className="m-0 mt-1 text-[13px] text-fg-muted">
                                  Часовой пояс: {time.timeZone}
                                </p>
                              </details>
                            )
                          })()
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {copiedCommit ? (
                  <p role="status" className="m-0 mt-2 text-right text-[13px] text-sev-strength-fg">
                    Полный SHA скопирован
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-fg-muted">Подробный отчёт ещё не опубликован.</p>
            )}
          </section>
        </div>

        <footer className="border-t border-line px-6 py-5">
          {summary.status === 'done' || summary.status === 'running' ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14.5px] font-medium text-primary-foreground no-underline transition-transform active:scale-[0.96]"
              to={`/team/${encodeURIComponent(summary.team_id)}`}
              onClick={onClose}
            >
              {summary.status === 'running' ? 'Смотреть ход оценки' : 'Открыть полный отчёт'}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <div className="flex items-center gap-2 text-[14px] text-fg-muted">
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

function StatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Check
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Icon aria-hidden="true" size={15} className="text-fg-muted" />
      <span className="text-fg-muted">{label}:</span>
      <strong className="font-medium text-fg">{value}</strong>
    </div>
  )
}
