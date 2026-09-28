import { Check, ChevronDown, ChevronUp, ExternalLink, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import type { FindingView } from '@/shared/api'

import { useHighlightedSnippet } from '../model/highlight-snippet'
import { linkState } from '../model/link-state'
import { SEVERITY_BG, SEVERITY_BORDER, SEVERITY_FG, SEVERITY_LABEL } from '../model/severity'

/**
 * Находка — `design/reference/screens/06-metric-drilldown.html`. Две плотности
 * (`summary`/`expanded`) и три состояния ссылки (`entities/finding/model/link-state.ts`). «По
 * умолчанию развёрнута только первая находка и только самая серьёзная. Остальные — одна строка
 * каждая; код открывается по запросу» (DESIGN.md).
 */

export interface FindingCardProps {
  finding: FindingView
  density: 'summary' | 'expanded'
  permalinkBase?: string
  onToggle?: () => void
  className?: string
}

function SeverityBadge({ severity }: { severity: FindingView['severity'] }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-badge border px-2 text-[13px] font-medium ${SEVERITY_BORDER[severity]} ${SEVERITY_BG[severity]} ${SEVERITY_FG[severity]}`}
    >
      <TriangleAlert aria-hidden="true" size={12} strokeWidth={2.1} />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

function StrengthBadge() {
  return (
    <span className="inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-badge border border-sev-strength-border bg-sev-strength-bg px-2 text-[13px] font-medium text-sev-strength-fg">
      <Check aria-hidden="true" size={12} strokeWidth={2.3} />
      Сильная сторона
    </span>
  )
}

function SnippetView({ finding }: { finding: FindingView }) {
  const tokens = useHighlightedSnippet(finding)
  const snippet = finding.snippet
  if (!snippet) return null
  const lines = snippet.split('\n')
  const extension = finding.file.split('.').pop()?.toUpperCase() ?? ''

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-code">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3 py-[7px]">
        <span className="font-mono text-[13.5px] text-fg-muted">{finding.file}</span>
        <span className="text-[13px] text-fg-subtle">
          {extension} · строки {finding.line_start}–{finding.line_end}
        </span>
      </div>
      <pre className="m-0 overflow-x-auto py-2.5 font-mono text-[14px] leading-[1.75]">
        <code>
          {lines.map((line, index) => {
            const lineNumber = finding.line_start + index
            const isTarget = lineNumber >= finding.line_start && lineNumber <= finding.line_end
            const lineTokens = tokens?.[index]
            return (
              <span
                key={`${lineNumber}-${line}`}
                className={`block px-3 ${isTarget ? 'border-l-[3px] border-l-sev-major-chart bg-sev-major-bg' : ''}`}
              >
                <span className="mr-3.5 inline-block w-[30px] text-right text-fg-faint select-none tabular-nums">
                  {lineNumber}
                </span>
                {lineTokens
                  ? lineTokens.map((token, tokenIndex) => (
                      <span key={`${tokenIndex}-${token.content}`} style={{ color: token.color }}>
                        {token.content}
                      </span>
                    ))
                  : line || ' '}
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}

export function FindingCard({
  finding,
  density,
  permalinkBase,
  onToggle,
  className,
}: FindingCardProps) {
  const [codeExpanded, setCodeExpanded] = useState(true)
  const state = linkState(finding)
  const location = `${finding.file} : ${finding.line_start}–${finding.line_end}`

  if (density === 'summary') {
    return (
      <div
        className={`flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-[11px] ${className ?? ''}`}
      >
        {finding.kind === 'issue' ? (
          <SeverityBadge severity={finding.severity} />
        ) : (
          <StrengthBadge />
        )}
        <div className="flex min-w-0 flex-grow flex-col gap-0.5">
          <span className="text-[15px]">{finding.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-[13.5px] text-fg-muted">
            {finding.kind === 'issue' ? 'Проблема · ' : null}
            <span className="font-mono">{location}</span>
            {state === 'unverified' ? (
              <span className="inline-flex items-center gap-1 rounded-[5px] border border-dashed border-line-strong px-1.5 py-px text-[13px] text-fg-subtle">
                ссылку не удалось проверить
              </span>
            ) : null}
          </span>
        </div>
        {state === 'unverified' ? (
          <span className="max-w-[300px] text-right text-[13.5px] text-fg-subtle">
            Фрагмент кода не показывается: по этой ссылке файл не открылся на указанном коммите
          </span>
        ) : (
          <span className="text-[13.5px] text-fg-subtle">
            {finding.snippet ? 'код свёрнут' : null}
          </span>
        )}
        {onToggle ? (
          <button
            type="button"
            aria-expanded={false}
            onClick={onToggle}
            className="flex min-h-11 shrink-0 items-center gap-[5px] rounded-[7px] border border-line-strong bg-surface px-2.5 text-[14px] text-fg md:min-h-10"
          >
            {state === 'unverified' ? 'Подробнее' : finding.snippet ? 'Показать код' : 'Подробнее'}
            <ChevronDown aria-hidden="true" size={12} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    )
  }

  const outerBorder =
    finding.kind === 'issue' ? SEVERITY_BORDER[finding.severity] : 'border-sev-strength-border'
  const headerBg = finding.kind === 'issue' ? SEVERITY_BG[finding.severity] : 'bg-sev-strength-bg'

  return (
    <div
      className={`overflow-hidden rounded-card border ${outerBorder} bg-surface ${className ?? ''}`}
    >
      <div className={`flex items-start gap-3 px-4 py-[13px] ${headerBg}`}>
        {finding.kind === 'issue' ? (
          <SeverityBadge severity={finding.severity} />
        ) : (
          <StrengthBadge />
        )}
        <div className="flex flex-grow flex-col gap-[3px]">
          <span className="text-[16px] font-medium">{finding.title}</span>
          <span className="text-[14px] text-fg-muted">
            {finding.kind === 'issue' ? 'Проблема · ' : null}
            <span className="font-mono">{location}</span>
          </span>
        </div>
        {state === 'verified' && permalinkBase ? (
          <a
            href={finding.permalink}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 shrink-0 items-center gap-[5px] rounded-[7px] border border-line-strong bg-surface px-2.5 text-[14px] text-fg no-underline md:min-h-10"
          >
            Открыть на {permalinkBase}
            <ExternalLink aria-hidden="true" size={12} strokeWidth={2} />
          </a>
        ) : null}
        {finding.snippet ? (
          <button
            type="button"
            aria-expanded={codeExpanded}
            onClick={() => setCodeExpanded((value) => !value)}
            className="flex min-h-11 shrink-0 items-center gap-[5px] rounded-[7px] border border-line-strong bg-surface px-2.5 text-[14px] text-fg md:min-h-10"
          >
            {codeExpanded ? 'Свернуть код' : 'Показать код'}
            {codeExpanded ? (
              <ChevronUp aria-hidden="true" size={12} strokeWidth={2.2} />
            ) : (
              <ChevronDown aria-hidden="true" size={12} strokeWidth={2.2} />
            )}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3.5">
        <p className="max-w-[1000px] text-[14.5px] leading-[1.65] text-fg-muted">
          {finding.explanation}
        </p>

        {state !== 'unverified' && codeExpanded ? <SnippetView finding={finding} /> : null}
        {state === 'unverified' ? (
          <p className="text-[14.5px] text-fg-subtle">
            Ссылку не удалось проверить — фрагмент не показан, чтобы не показать чужой код под этим
            заголовком.
          </p>
        ) : null}

        {finding.kind === 'issue' && finding.suggestion ? (
          <div className="flex items-start gap-2.5 rounded-control border border-line bg-muted-surface px-3.5 py-[11px]">
            <span className="mt-px shrink-0 text-[12.5px] tracking-[0.05em] text-fg-subtle uppercase">
              Рекомендация
            </span>
            <span className="text-[14.5px] leading-[1.6] text-fg">{finding.suggestion}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
