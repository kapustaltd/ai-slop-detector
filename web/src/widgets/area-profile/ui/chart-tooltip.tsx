import type { TooltipContentProps } from 'recharts'

function formatValue(value: unknown) {
  if (typeof value === 'number') return value.toFixed(1)
  if (Array.isArray(value)) return value.join('–')
  return String(value ?? '—')
}

export function ChartTooltip({ active, label, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null

  return (
    <div className="rounded-panel border border-line-strong bg-surface px-3 py-2 text-meta text-fg shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {payload.map((entry) => (
          <li
            key={`${String(entry.dataKey)}-${String(entry.name)}`}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{
                backgroundColor: entry.color ?? entry.stroke ?? entry.fill ?? 'var(--ds-fg-muted)',
              }}
            />
            <span className="text-fg-muted">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-fg">
              {formatValue(entry.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
