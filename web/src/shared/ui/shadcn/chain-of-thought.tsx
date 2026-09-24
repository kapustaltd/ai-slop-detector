import { ChevronRight } from 'lucide-react'
import { Collapsible } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from 'cn'

export type ChainOfThoughtStepStatus = 'complete' | 'active' | 'pending'

export function ChainOfThought({ className, ...props }: ComponentProps<typeof Collapsible.Root>) {
  return <Collapsible.Root className={cn('border-l-2 border-line pl-3', className)} {...props} />
}

export function ChainOfThoughtHeader({
  children = 'Этапы обработки',
  className,
  ...props
}: ComponentProps<typeof Collapsible.Trigger>) {
  return (
    <Collapsible.Trigger
      className={cn(
        'group inline-flex min-h-9 items-center gap-1 text-sm text-fg-muted hover:text-fg',
        className,
      )}
      {...props}
    >
      <ChevronRight
        aria-hidden="true"
        size={15}
        className="transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
      />
      {children}
    </Collapsible.Trigger>
  )
}

export function ChainOfThoughtContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Collapsible.Content>) {
  return (
    <Collapsible.Content className={cn('overflow-hidden', className)} {...props}>
      <ol className="m-0 flex list-none flex-col pt-2 pl-0">{children}</ol>
    </Collapsible.Content>
  )
}

export function ChainOfThoughtStep({
  label,
  description,
  status = 'complete',
  className,
  ...props
}: Omit<ComponentProps<'li'>, 'children'> & {
  label: ReactNode
  description?: ReactNode
  status?: ChainOfThoughtStepStatus
}) {
  return (
    <li
      aria-current={status === 'active' ? 'step' : undefined}
      data-status={status}
      className={cn(
        'relative flex gap-3 pb-4 last:pb-0',
        'before:absolute before:top-4 before:bottom-0 before:left-[5px] before:w-px before:bg-line last:before:hidden',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 size-3 shrink-0 border',
          status === 'active' &&
            'border-primary bg-primary animate-pulse motion-reduce:animate-none',
          status === 'complete' && 'border-fg-muted bg-fg-muted',
          status === 'pending' && 'border-line-strong bg-surface',
        )}
      />
      <div className={cn('min-w-0 text-sm', status === 'pending' ? 'text-fg-muted' : 'text-fg')}>
        <span>{label}</span>
        <span className="sr-only">
          {status === 'complete'
            ? ' — завершено'
            : status === 'active'
              ? ' — выполняется'
              : ' — ожидает'}
        </span>
        {description ? <p className="mb-0 mt-1 text-xs text-fg-muted">{description}</p> : null}
      </div>
    </li>
  )
}
