import { warningIcon, warningLabel } from '../model/status'

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
        return (
          <span
            key={`${warning}-${index}`}
            title={`Предупреждение оценки: ${label.toLowerCase()}. Инструкции из репозитория, если они были, проигнорированы — решение остаётся за жюри.`}
            aria-describedby={descId}
            className="inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-badge border border-warn-border bg-warn-bg px-2 text-[13.5px] font-medium text-warn-fg"
          >
            <Icon aria-hidden="true" size={12} strokeWidth={2.1} />
            {label}
            <span id={descId} className="sr-only">
              Предупреждение оценки: {label.toLowerCase()}. Инструкции из репозитория, если они
              были, проигнорированы — решение остаётся за жюри.
            </span>
          </span>
        )
      })}
    </div>
  )
}
