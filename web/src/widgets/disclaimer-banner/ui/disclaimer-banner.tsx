import { CircleAlert, ChevronRight } from 'lucide-react'

/**
 * Рамка-пояснение, обязательная и на рейтинге, и на странице команды (DESIGN.md, «Рамка, которая
 * должна читаться в интерфейсе»): «Это вспомогательная метрика, а не вердикт». Текст фиксирован —
 * не параметризуется, чтобы формулировка не разъехалась между страницами.
 *
 * Правило DESIGN.md «Чего не делать»: без цветного фона и левой акцентной полосы — сообщение
 * не тревожное.
 */

export interface DisclaimerBannerProps {
  rubricHref?: string
}

export function DisclaimerBanner({ rubricHref }: DisclaimerBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-panel border border-line bg-surface px-4 py-3.5">
      <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <CircleAlert aria-hidden="true" size={14} strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-[3px]">
        <div className="text-[13.5px] font-medium">Это вспомогательная метрика, а не вердикт</div>
        <div className="max-w-[980px] text-[12.5px] leading-[1.55] text-fg-muted">
          Баллы выставлены моделью по фиксированной рубрике и описывают только то, что видно в коде
          репозитория. Идея, продуктовая ценность, демо и защита сюда не входят. Решение о
          победителях принимает жюри.
        </div>
      </div>
      {rubricHref ? (
        <a
          href={rubricHref}
          className="ml-auto flex shrink-0 items-center gap-[5px] text-[12.5px] font-medium no-underline"
        >
          Как считается оценка
          <ChevronRight aria-hidden="true" size={13} strokeWidth={2} />
        </a>
      ) : null}
    </div>
  )
}
