import { AnchorScale, isLowConfidence, nodeContribution, TaxonomyRow } from '@/entities/metric'
import { findingSlug, FindingCard, SEVERITY_ORDER } from '@/entities/finding'
import type { RubricBundle, TeamArea, TeamMetric } from '@/shared/api'

import type { FindingsFilter } from '../model/findings-filter'
import { rubricMetricMap } from '../model/rubric-lookup'
import type { TaxonomyPath } from '../model/taxonomy-path'

/**
 * Категория → подкатегория → метрика на `TaxonomyRow` (005/006 инвентарь), лист — `AnchorScale` +
 * `FindingCard[]`. «Одновременно раскрыта одна ветка» (DESIGN.md) — `TaxonomyPath` хранит ровно
 * один путь, раскрытие узла заменяет путь целиком, а не добавляет к нему.
 */

export interface TaxonomyTreeProps {
  areaName: 'backend' | 'frontend'
  area: TeamArea
  rubric?: RubricBundle
  path: TaxonomyPath
  onPathChange: (next: TaxonomyPath) => void
  findingsFilter: FindingsFilter
  /** SHA команды — подпись кнопки «Открыть на `<sha>`» у верифицированной ссылки находки. */
  commitSha?: string
}

function metricFindingsCount(metric: TeamMetric) {
  return metric.findings.length
}

function metricSubcategoriesLabel(count: number) {
  return count === 1 ? 'метрика' : count < 5 ? 'метрики' : 'метрик'
}

export function TaxonomyTree({
  areaName,
  area,
  rubric,
  path,
  onPathChange,
  findingsFilter,
  commitSha,
}: TaxonomyTreeProps) {
  const rubricMetrics = rubricMetricMap(rubric)
  const isActiveArea = path.area === areaName

  const collapseAll = () =>
    onPathChange({
      area: areaName,
      categoryId: null,
      subcategoryId: null,
      metricId: null,
      findingSlug: null,
    })

  return (
    <section aria-label={`Разбор по рубрике · ${areaName}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[17px] font-medium">Разбор по рубрике · {areaName}</h3>
        <button
          type="button"
          onClick={collapseAll}
          className="min-h-11 rounded-[7px] border border-line-strong bg-surface px-2.5 text-[14px] text-fg md:min-h-10"
        >
          Свернуть всё
        </button>
      </div>

      {/* Строки узла держат фиксированную минимальную ширину колонок (вес/балл/вклад) — на
          узких экранах дерево скроллится по горизонтали в своём контейнере, а не обрезается
          (web/CLAUDE.md: широкий контент скроллится в overflow-x-auto, страница — никогда). */}
      <div className="overflow-x-auto rounded-card border border-line">
        <div className="min-w-[1100px]">
          {area.categories.map((category) => {
            const categoryExpanded = isActiveArea && path.categoryId === category.id
            return (
              <div key={category.id}>
                <TaxonomyRow
                  level={1}
                  name={category.name}
                  weight={category.weight}
                  weightLabel={`вес ${category.weight.toFixed(2)}`}
                  score={category.score}
                  contribution={{
                    value: nodeContribution(category.weight, category.score),
                    // area.score типизирован как number | null, но раз есть category — область
                    // done и балл есть; ?? 0 только для типов, на практике недостижимо.
                    ofTotal: area.score ?? 0,
                    label: `вклад в ${areaName}`,
                  }}
                  trailing={`${category.subcategories.reduce((sum, sub) => sum + sub.metrics.reduce((s, m) => s + metricFindingsCount(m), 0), 0)} находок`}
                  expanded={categoryExpanded}
                  onToggle={() =>
                    onPathChange(
                      categoryExpanded
                        ? {
                            area: areaName,
                            categoryId: null,
                            subcategoryId: null,
                            metricId: null,
                            findingSlug: null,
                          }
                        : {
                            area: areaName,
                            categoryId: category.id,
                            subcategoryId: null,
                            metricId: null,
                            findingSlug: null,
                          },
                    )
                  }
                />

                {categoryExpanded
                  ? category.subcategories.map((subcategory) => {
                      const subcategoryExpanded = path.subcategoryId === subcategory.id
                      return (
                        <div key={subcategory.id}>
                          <TaxonomyRow
                            level={2}
                            name={subcategory.name}
                            weight={subcategory.weight}
                            weightLabel={`вес ${subcategory.weight.toFixed(2)} внутри категории`}
                            score={subcategory.score}
                            contribution={{
                              value: nodeContribution(subcategory.weight, subcategory.score),
                              ofTotal: category.score,
                              label: 'вклад в категорию',
                            }}
                            trailing={`${subcategory.metrics.length} ${metricSubcategoriesLabel(subcategory.metrics.length)}`}
                            expanded={subcategoryExpanded}
                            onToggle={() =>
                              onPathChange(
                                subcategoryExpanded
                                  ? {
                                      area: areaName,
                                      categoryId: category.id,
                                      subcategoryId: null,
                                      metricId: null,
                                      findingSlug: null,
                                    }
                                  : {
                                      area: areaName,
                                      categoryId: category.id,
                                      subcategoryId: subcategory.id,
                                      metricId: null,
                                      findingSlug: null,
                                    },
                              )
                            }
                          />

                          {subcategoryExpanded
                            ? subcategory.metrics.map((metric) => {
                                const metricExpanded = path.metricId === metric.id
                                return (
                                  <div key={metric.id}>
                                    <TaxonomyRow
                                      level={3}
                                      name={metric.name}
                                      idSlug={metricExpanded ? metric.id : undefined}
                                      weight={metric.weight}
                                      weightLabel={`вес ${metric.weight.toFixed(2)} в подкатегории`}
                                      weightContext={
                                        metricExpanded
                                          ? `= ${nodeContribution(nodeContribution(metric.weight, subcategory.weight), category.weight).toFixed(3)} от ${areaName}`
                                          : undefined
                                      }
                                      score={metric.score}
                                      confidence={metric.confidence}
                                      trailing={`${metricFindingsCount(metric)} находок`}
                                      expanded={metricExpanded}
                                      onToggle={() =>
                                        onPathChange(
                                          metricExpanded
                                            ? {
                                                area: areaName,
                                                categoryId: category.id,
                                                subcategoryId: subcategory.id,
                                                metricId: null,
                                                findingSlug: null,
                                              }
                                            : {
                                                area: areaName,
                                                categoryId: category.id,
                                                subcategoryId: subcategory.id,
                                                metricId: metric.id,
                                                findingSlug: null,
                                              },
                                        )
                                      }
                                    />
                                    {metricExpanded ? (
                                      <MetricPanel
                                        areaName={areaName}
                                        metric={metric}
                                        rubricMetric={rubricMetrics.get(metric.id)}
                                        findingsFilter={findingsFilter}
                                        activeFindingSlug={path.findingSlug}
                                        commitSha={commitSha}
                                        onActivateFinding={(slug) =>
                                          onPathChange({ ...path, findingSlug: slug })
                                        }
                                      />
                                    ) : null}
                                  </div>
                                )
                              })
                            : null}
                        </div>
                      )
                    })
                  : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function MetricPanel({
  areaName,
  metric,
  rubricMetric,
  findingsFilter,
  activeFindingSlug,
  commitSha,
  onActivateFinding,
}: {
  areaName: string
  metric: TeamMetric
  rubricMetric?: {
    description: string
    anchors: { '2': string; '5': string; '8': string; '10': string }
  }
  findingsFilter: FindingsFilter
  activeFindingSlug: string | null
  commitSha?: string
  onActivateFinding: (slug: string) => void
}) {
  const findings = metric.findings.filter((finding) => {
    const kindMatches = findingsFilter.kind === 'all' || finding.kind === findingsFilter.kind
    const severityMatches =
      findingsFilter.severity === 'all' || finding.severity === findingsFilter.severity
    return kindMatches && severityMatches
  })
  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  )
  const defaultActiveSlug = sorted[0] ? findingSlug(sorted[0]) : null
  const effectiveActiveSlug = activeFindingSlug ?? defaultActiveSlug

  return (
    <div className="flex flex-col gap-3.5 border-t border-line bg-surface px-4 py-4 pl-[68px]">
      {isLowConfidence(metric.confidence) ? (
        <p className="rounded-panel border border-dashed border-line-strong bg-muted-surface px-3.5 py-2.5 text-[14.5px] text-fg-muted">
          Уверенность модели низкая — балл не приглушён и учитывается на общих основаниях, но стоит
          проверить вручную.
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <span className="text-[13px] tracking-[0.05em] text-fg-subtle uppercase">
          Краткий вывод
        </span>
        <p className="m-0 text-[15px] leading-[1.55] text-fg">{metric.summary}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[13px] tracking-[0.05em] text-fg-subtle uppercase">
          Развёрнутое обоснование
        </span>
        <p className="m-0 text-[15px] leading-[1.6] whitespace-pre-wrap text-fg-muted">
          {metric.rationale}
        </p>
      </div>

      {rubricMetric ? (
        <AnchorScale
          anchors={rubricMetric.anchors}
          score={metric.score}
          rubricLabel={`рубрика ${areaName}`}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[15px] font-medium">Находки по этой метрике</span>
          <span className="text-[13.5px] text-fg-subtle">{findings.length}</span>
        </div>
        {findings.length === 0 ? (
          <p className="text-[14.5px] text-fg-subtle">По текущим фильтрам находок нет.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((finding) => {
              const slug = findingSlug(finding)
              const isActive = slug === effectiveActiveSlug
              return (
                <FindingCard
                  key={slug}
                  finding={finding}
                  density={isActive ? 'expanded' : 'summary'}
                  permalinkBase={finding.permalink ? commitSha : undefined}
                  onToggle={isActive ? undefined : () => onActivateFinding(slug)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
