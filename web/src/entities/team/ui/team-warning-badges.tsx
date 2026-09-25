import { warningIcon, warningLabel } from '../model/status'

const WARNING_DESCRIPTIONS: Record<string, string> = {
  suspected_prompt_injection: 'Инструкции из репозитория не влияли на оценку.',
  repo_too_large: 'Репозиторий превышает лимит размера для полной проверки.',
  file_limit_exceeded: 'Часть файлов пропущена из-за лимита размера.',
  secret_redacted: 'Секретные значения скрыты в отчёте.',
  incomplete_area: 'Оценка охватила не все области репозитория.',
  provider_error: 'При проверке возникла ошибка сервиса оценки.',
}

/**
 * Колонка «Признаки» рейтинга — по одному бейджу на каждое значение `warnings[]`. Иконка/подпись —
 * в `entities/team/model/status.ts`, здесь только разметка. `partial` сюда не входит: на макете
 * рейтинга он заменяет бейдж статуса (см. `TeamStatusBadge`), а не добавляет отдельный флаг в эту
 * колонку.
 */

export interface TeamWarningBadgesProps {
  warnings: string[] | undefined
  className?: string
}

export function TeamWarningBadges({ warnings, className }: TeamWarningBadgesProps) {
  if (!warnings || warnings.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ''}`}>
      {warnings.map((warning, index) => {
        const Icon = warningIcon(warning)
        const label = warningLabel(warning)
        const descId = `team-warning-desc-${warning}-${index}`
        const description =
          WARNING_DESCRIPTIONS[warning] ?? 'В отчёте есть предупреждение об этой оценке.'
        const tone =
          warning === 'provider_error' || warning === 'suspected_prompt_injection'
            ? 'border-sev-critical-border bg-sev-critical-bg text-sev-critical-fg'
            : warning === 'secret_redacted'
              ? 'border-sev-info-border bg-sev-info-bg text-sev-info-fg'
              : 'border-warn-border bg-warn-bg text-warn-fg'
        return (
          <span
            key={`${warning}-${index}`}
            title={description}
            aria-describedby={descId}
            className={`inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-badge border px-2 text-[13.5px] font-medium ${tone}`}
          >
            <Icon aria-hidden="true" size={12} strokeWidth={2.1} />
            {label}
            <span id={descId} className="sr-only">
              {description}
            </span>
          </span>
        )
      })}
    </div>
  )
}
