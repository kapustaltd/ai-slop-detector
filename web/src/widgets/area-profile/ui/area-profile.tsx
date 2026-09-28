import { useState } from 'react'
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
import { SectionLink } from '@/shared/ui'

import { areaChartData, type CategoryChartPoint } from '../model/chart-data'

/**
 * Аналитика области: сравнение по категориям — основной режим, радар — дополнительный профиль.
 * Таблица остаётся точной текстовой альтернативой графику и содержит ссылки в разбор находок.
 */

export interface AreaProfileProps {
  areaName: 'backend' | 'frontend'
  area: TeamArea
  stats?: StatsBundle['areas'][number]
}

type ChartView = 'comparison' | 'profile'
type ComparisonBasis = 'median' | 'mean'

const chartNumber = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const exactNumber = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const MIN_COMPARISON_SAMPLE = 2

function areaLabel(areaName: string): string {
  return areaName.charAt(0).toUpperCase() + areaName.slice(1)
}

function pluralTeams(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'команда'
  if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'команды'
  }
  return 'команд'
}

function formatChartValue(value: unknown): string {
  return typeof value === 'number' ? chartNumber.format(value) : ''
}

function formatExactValue(value: unknown): string {
  return typeof value === 'number' ? exactNumber.format(value) : '—'
}

function AreaChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="max-w-64 rounded-control border border-line bg-surface p-3 text-sm text-fg shadow-md">
      <p className="m-0 mb-2 break-words font-medium">{label}</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {payload.map((entry) => (
          <li key={entry.dataKey?.toString() ?? entry.name} className="flex justify-between gap-4">
            <span>{entry.name}</span>
            <span className="font-medium tabular-nums">{formatExactValue(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ComparisonBasisSwitch({
  basis,
  onChange,
}: {
  basis: ComparisonBasis
  onChange: (basis: ComparisonBasis) => void
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-[13.5px]"
      role="group"
      aria-label="База сравнения"
    >
      <span className="text-fg-muted">Сравнивать с:</span>
      {(['median', 'mean'] as const).map((option) => {
        const label = option === 'median' ? 'Медиана' : 'Среднее'
        return (
          <button
            key={option}
            type="button"
            className={`min-h-9 rounded-control border px-3 font-medium transition-colors ${
              basis === option
                ? 'border-line-strong bg-muted-surface text-fg'
                : 'border-line text-fg-muted hover:bg-muted-surface hover:text-fg'
            }`}
            aria-pressed={basis === option}
            onClick={() => onChange(option)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function ChartLegendNote({
  sampleSize,
  insufficientData,
}: {
  sampleSize: number
  insufficientData: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13.5px] leading-5 text-fg-muted">
      {insufficientData ? (
        <span>
          Сравнение появится, когда будут оценены минимум {MIN_COMPARISON_SAMPLE} команды.
        </span>
      ) : (
        <span>
          Состав выборки:{' '}
          {sampleSize > 0 ? `${sampleSize} ${pluralTeams(sampleSize)}` : 'данные недоступны'}
        </span>
      )}
    </div>
  )
}

function ComparisonChart({
  data,
  basis,
  comparisonAvailable,
}: {
  data: CategoryChartPoint[]
  basis: ComparisonBasis
  comparisonAvailable: boolean
}) {
  const comparisonLabel = basis === 'median' ? 'Медиана' : 'Среднее'

  return (
    <div className="h-[368px] rounded-panel border border-line bg-muted-surface/35 px-2 py-1 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 12, right: 48, bottom: 8, left: 0 }}
          barGap={4}
        >
          <CartesianGrid horizontal={false} stroke="var(--ds-chart-grid)" />
          <XAxis
            type="number"
            domain={[0, 10]}
            ticks={[0, 2, 4, 6, 8, 10]}
            tick={{ fontSize: 12, fill: 'var(--ds-fg-muted)' }}
            axisLine={{ stroke: 'var(--ds-chart-grid-outer)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={240}
            tick={{ fontSize: 13, fill: 'var(--ds-fg)' }}
            axisLine={false}
            tickLine={false}
          />
          {comparisonAvailable ? (
            <>
              <Tooltip cursor={{ fill: 'var(--ds-chart-cursor)' }} content={AreaChartTooltip} />
              <Legend wrapperStyle={{ paddingTop: 12, fontSize: 13 }} />
            </>
          ) : null}
          <Bar
            dataKey="score"
            name="Команда"
            fill="var(--ds-chart-team-stroke)"
            barSize={20}
            activeBar={false}
            label={{
              position: 'right',
              fill: 'var(--ds-fg)',
              fontSize: 13,
              formatter: formatChartValue,
            }}
          />
          {comparisonAvailable ? (
            <Bar
              dataKey={basis}
              name={comparisonLabel}
              fill="var(--ds-chart-average-bar)"
              barSize={20}
              activeBar={false}
              label={{
                position: 'right',
                fill: 'var(--ds-fg-muted)',
                fontSize: 13,
                formatter: formatChartValue,
              }}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProfileChart({
  data,
  basis,
  comparisonAvailable,
}: {
  data: CategoryChartPoint[]
  basis: ComparisonBasis
  comparisonAvailable: boolean
}) {
  const comparisonLabel = basis === 'median' ? 'Медиана' : 'Среднее'

  return (
    <div className="h-[368px] rounded-panel border border-line bg-muted-surface/35 px-2 py-1 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--ds-chart-grid)" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--ds-fg)' }} />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          {comparisonAvailable ? (
            <Radar
              name={comparisonLabel}
              dataKey={basis}
              stroke="var(--ds-chart-median-stroke)"
              fill="none"
              strokeDasharray="5 4"
              strokeWidth={1.8}
            />
          ) : null}
          <Radar
            name="Команда"
            dataKey="score"
            stroke="var(--ds-chart-team-stroke)"
            fill="var(--ds-chart-team-fill)"
            fillOpacity={1}
            strokeWidth={2.2}
          />
          <Tooltip cursor={false} content={AreaChartTooltip} />
          {comparisonAvailable ? (
            <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 16, fontSize: 13 }} />
          ) : null}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AreaProfile({ areaName, area, stats }: AreaProfileProps) {
  const [view, setView] = useState<ChartView>('comparison')
  const [basis, setBasis] = useState<ComparisonBasis>('median')
  const sampleSize = stats?.sample_size ?? 0
  const insufficientData = !stats || stats.insufficient_data
  const data = areaChartData(area, insufficientData ? undefined : stats)
  const comparisonAvailable = data.some((row) => row[basis] != null)
  const areaTitle = areaLabel(areaName)
  const chartTitle = insufficientData ? 'Оценки по категориям' : 'Сравнение по категориям'

  return (
    <section
      id={`area-${areaName}`}
      aria-label={`${chartTitle} — ${areaName}`}
      className="area-profile flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-[19px] font-medium tracking-[-0.02em]">
            Аналитика · {areaTitle}
          </h2>
          <p className="m-0 mt-1 text-[14px] leading-5 text-fg-muted">
            Баллы категорий и подтверждённые находки области на шкале 0–10.
          </p>
        </div>
        <div
          className="flex rounded-control border border-line p-0.5"
          role="group"
          aria-label="Режим графика"
        >
          {(['comparison', 'profile'] as const).map((option) => {
            const label = option === 'comparison' ? chartTitle : 'Профиль'
            return (
              <button
                key={option}
                type="button"
                className={`min-h-9 rounded-[6px] px-3 text-[13.5px] font-medium transition-colors ${
                  view === option
                    ? 'bg-muted-surface text-fg'
                    : 'text-fg-muted hover:bg-muted-surface hover:text-fg'
                }`}
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {insufficientData ? (
        <ChartLegendNote sampleSize={sampleSize} insufficientData />
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <ComparisonBasisSwitch basis={basis} onChange={setBasis} />
          <ChartLegendNote sampleSize={sampleSize} insufficientData={false} />
        </div>
      )}

      <div className="area-profile-chart-stage" aria-live="polite">
        <div
          className={`area-profile-chart-view ${view === 'comparison' ? 'is-active' : ''}`}
          aria-hidden={view !== 'comparison'}
        >
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[15px] font-medium">{chartTitle}</h3>
            <ComparisonChart data={data} basis={basis} comparisonAvailable={comparisonAvailable} />
          </div>
        </div>
        <div
          className={`area-profile-chart-view ${view === 'profile' ? 'is-active' : ''}`}
          aria-hidden={view !== 'profile'}
        >
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[15px] font-medium">Профиль по категориям</h3>
            <ProfileChart data={data} basis={basis} comparisonAvailable={comparisonAvailable} />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-panel border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-muted-surface px-3 py-2.5">
          <div>
            <h3 className="m-0 text-[14.5px] font-medium">Точные значения</h3>
            <p className="m-0 mt-0.5 text-[13px] text-fg-muted">
              Нажмите на категорию, чтобы перейти к её разбору и находкам.
            </p>
          </div>
          <span className="text-[13px] text-fg-muted">Шкала 0–10</span>
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
                  Балл
                </th>
                {insufficientData ? null : (
                  <th
                    scope="col"
                    className="text-overline px-3 py-2 text-right text-fg-muted uppercase"
                  >
                    {basis === 'median' ? 'Медиана' : 'Среднее'}
                  </th>
                )}
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
                  <th scope="row" className="px-3 py-2 text-left text-[14px] font-normal text-fg">
                    <SectionLink
                      target={`area-${areaName}-category-${row.id}`}
                      className="text-link underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </SectionLink>
                  </th>
                  <td className="px-3 py-2 text-right text-[14px] font-medium tabular-nums">
                    {formatExactValue(row.score)}
                  </td>
                  {insufficientData ? null : (
                    <td className="px-3 py-2 text-right text-[14px] text-fg-muted tabular-nums">
                      {formatExactValue(row[basis])}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-[14px] text-fg-muted tabular-nums">
                    {row.findingsCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="border-t border-line px-3 py-2.5">
          <summary className="cursor-pointer text-[13.5px] font-medium text-link">
            Показать расчёт
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-fg-muted">
                  <th className="pb-2 font-normal">Категория</th>
                  <th className="pb-2 text-right font-normal">Вес</th>
                  <th className="pb-2 text-right font-normal">Вклад</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-normal text-fg">
                      {row.name}
                    </th>
                    <td className="py-2 text-right tabular-nums text-fg-muted">
                      {row.weight.toFixed(2)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-fg-muted">
                      {row.contribution.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  )
}
