/**
 * `?area=&node=&finding=` — контракт `specs/006-team-details/contracts/url-params.md`. `node`
 * хранит `categoryId[.subcategoryId[.metricId]]` одной строкой с точкой-разделителем.
 */

export interface TaxonomyPath {
  area: 'backend' | 'frontend' | null
  categoryId: string | null
  subcategoryId: string | null
  metricId: string | null
  findingSlug: string | null
}

export const EMPTY_PATH: TaxonomyPath = {
  area: null,
  categoryId: null,
  subcategoryId: null,
  metricId: null,
  findingSlug: null,
}

function parseArea(value: string | null): 'backend' | 'frontend' | null {
  return value === 'backend' || value === 'frontend' ? value : null
}

export function parseTaxonomyPath(searchParams: URLSearchParams): TaxonomyPath {
  const area = parseArea(searchParams.get('area'))
  if (!area) return EMPTY_PATH

  const node = searchParams.get('node')
  const [categoryId = null, subcategoryId = null, metricId = null] = node ? node.split('.') : []

  // `finding` без раскрытой до метрики ветки игнорируется (contracts/url-params.md).
  const findingSlug = metricId ? searchParams.get('finding') : null

  return { area, categoryId, subcategoryId, metricId, findingSlug }
}

export function serializeTaxonomyPath(path: TaxonomyPath): Record<string, string | null> {
  const node = [path.categoryId, path.subcategoryId, path.metricId].filter(Boolean).join('.')
  return {
    area: path.area,
    node: node || null,
    finding: path.metricId ? path.findingSlug : null,
  }
}
