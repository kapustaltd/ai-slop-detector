import type { LucideIcon } from 'lucide-react'

/**
 * EmptyState — 6-й компонент инвентаря (design/reference/screens/09-components-a11y.html):
 * «иконка, заголовок, причина словами, одно действие. Для пустого набора данных действия нет:
 * конвейер обновит страницу сам».
 *
 * Два расположения из макета (`07-states.html`, состояние 10) — не варианты одного и того же
 * блока, а два разных случая: `panel` — крупный центрированный блок для состояния конвейера
 * (нет данных / ошибка загрузки), `inline` — компактная строка внутри уже отрисованной таблицы
 * (пустой результат фильтра, всегда с действием).
 */

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  /** Пустой набор данных целиком — действия нет, конвейер обновит страницу сам. */
  action?: { label: string; onClick: () => void }
  layout?: 'panel' | 'inline'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  layout = 'panel',
  className,
}: EmptyStateProps) {
  if (layout === 'inline') {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-3.5 py-2.5 ${className ?? ''}`}
      >
        <Icon aria-hidden="true" size={15} strokeWidth={2} className="shrink-0 text-fg-subtle" />
        <div className="flex flex-grow flex-col gap-0.5">
          <span className="text-[14.5px]">{title}</span>
          <span className="text-[13.5px] text-fg-subtle">{description}</span>
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="min-h-11 shrink-0 rounded-control border border-line-strong bg-surface px-3 text-[14px] font-medium text-fg hover:bg-muted-surface md:min-h-10"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-start gap-2 border-y border-line px-1 py-6 text-left ${className ?? ''}`}
    >
      <Icon aria-hidden="true" size={22} strokeWidth={1.5} className="text-fg-subtle" />
      <div className="text-strong">{title}</div>
      <div className="max-w-[540px] text-[14px] leading-[1.6] text-fg-muted">{description}</div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-11 rounded-control border border-line-strong bg-surface px-3 text-[14px] font-medium text-fg hover:bg-muted-surface md:min-h-10"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
