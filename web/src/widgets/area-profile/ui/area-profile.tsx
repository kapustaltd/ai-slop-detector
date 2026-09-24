import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'

import type { StatsBundle, TeamArea } from '@/shared/api'

import { areaChartData } from '../model/chart-data'

/**
 * Radar + bar-vs-среднее + текстовая таблица-альтернатива, всегда развёрнутая (DESIGN.md: «не под
 * кнопку», FR-006). Radar несёт вторую серию — медиану, пунктиром (FR-002; в дошаблонной
 * реализации медиана вычислялась, но нигде не рисовалась — исправлено здесь, см. tasks.md T029).
 */

export interface AreaProfileProps {
  areaName: 'backend' | 'frontend'
  area: TeamArea
  stats?: StatsBundle['areas'][number]
}

const tooltipNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
const MIN_COMPARISON_SAMPLE = 5

function AreaChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="max-w-64 rounded-control border border-line bg-surface p-3 text-sm text-fg shadow-md">
      <p className="m-0 mb-2 font-medium break-words">{label}</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {payload.map((entry) => (
          <li key={entry.dataKey?.toString() ?? entry.name} className="flex justify-between gap-4">
            <span>{entry.name}</span>
            <span className="font-medium tabular-nums">
              {typeof entry.value === 'number'
                ? tooltipNumber.format(entry.value)
                : String(entry.value ?? '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AreaProfile({ areaName, area, stats }: AreaProfileProps) {
  const sampleSize = stats?.sample_size ?? 0
  const insufficientData = !stats || stats.insufficient_data || sampleSize < MIN_COMPARISON_SAMPLE
  const data = areaChartData(area, insufficientData ? undefined : stats)

  return (
    <section
      aria-label={`Профиль по категориям — ${areaName}`}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-medium">Профиль по категориям · {areaName}</h3>
            <span className="text-[13px] text-fg-subtle">шкала 0–10</span>
          </div>
          <div className="h-96" aria-label={`Лепестковая диаграмма — ${areaName}`}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} margin={{ top: 8, bottom: 8 }}>
                <PolarGrid stroke="var(--ds-chart-grid)" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                {insufficientData ? null : (
                  <Radar
                    name="Медиана"
                    dataKey="median"
                    stroke="var(--ds-chart-median-stroke)"
                    fill="none"
                    strokeDasharray="5 4"
                    strokeWidth={1.8}
                  />
                )}
                <Radar
                  name="Команда"
                  dataKey="score"
                  stroke="var(--ds-chart-team-stroke)"
                  fill="var(--ds-chart-team-fill)"
                  fillOpacity={1}
                  strokeWidth={2.2}
                />
                <Tooltip content={AreaChartTooltip} />
                <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 16 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-medium">Команда против среднего</h3>
          {insufficientData ? (
            <p className="m-0 max-w-[42ch] text-sm leading-6 text-fg-muted">
              Недостаточно оценённых команд для сравнения. Профиль этой команды остаётся виден.
            </p>
          ) : (
            <div className="h-96" aria-label={`Сравнение со средним — ${areaName}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-chart-grid)" />
                  <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip content={AreaChartTooltip} />
                  <Legend />
                  <Bar dataKey="score" name="Команда" fill="var(--ds-chart-team-stroke)" />
                  <Bar dataKey="mean" name="Среднее" fill="var(--ds-chart-average-bar)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-panel border border-line">
        <div className="flex items-center justify-between border-b border-line bg-muted-surface px-3 py-2.5">
          <h4 className="m-0 text-[14.5px] font-medium">Категории</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-overline px-3 py-2 text-left text-fg-muted uppercase"
                >
                  Категория
                </th>
                <th
                  scope="col"
                  className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                >
                  Вес
                </th>
                <th
                  scope="col"
                  className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                >
                  Балл
                </th>
                {insufficientData ? null : (
                  <>
                    <th
                      scope="col"
                      className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                    >
                      Медиана
                    </th>
                    <th
                      scope="col"
                      className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                    >
                      Среднее
                    </th>
                  </>
                )}
                <th
                  scope="col"
                  className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                >
                  Вклад
                </th>
                <th
                  scope="col"
                  className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                >
                  Находок
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left text-[14.5px] font-normal text-fg">
                    {row.name}
                  </th>
                  <td className="px-3 py-2 text-right text-[14.5px] text-fg-muted tabular-nums">
                    {row.weight.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-[14.5px] font-medium tabular-nums">
                    {row.score.toFixed(1)}
                  </td>
                  {insufficientData ? null : (
                    <>
                      <td className="px-3 py-2 text-right text-[14.5px] text-fg-muted tabular-nums">
                        {row.median != null ? row.median.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-[14.5px] text-fg-muted tabular-nums">
                        {row.mean != null ? row.mean.toFixed(1) : '—'}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right text-[14.5px] text-fg-muted tabular-nums">
                    {row.contribution.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right text-[14.5px] text-fg-muted tabular-nums">
                    {row.findingsCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
