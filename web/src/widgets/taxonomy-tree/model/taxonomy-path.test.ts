import { describe, expect, it } from 'vitest'

import { EMPTY_PATH, parseTaxonomyPath, serializeTaxonomyPath } from './taxonomy-path'

describe('parseTaxonomyPath', () => {
  it('разбирает полный путь до метрики с находкой', () => {
    const params = new URLSearchParams(
      '?area=backend&node=security.authz.resource-level&finding=src%2Fa.ts%3A1-2',
    )
    expect(parseTaxonomyPath(params)).toEqual({
      area: 'backend',
      categoryId: 'security',
      subcategoryId: 'authz',
      metricId: 'resource-level',
      findingSlug: 'src/a.ts:1-2',
    })
  })

  it('node без area игнорируется', () => {
    const params = new URLSearchParams('?node=security.authz.resource-level')
    expect(parseTaxonomyPath(params)).toEqual(EMPTY_PATH)
  })

  it('finding без раскрытия до метрики игнорируется', () => {
    const params = new URLSearchParams('?area=backend&node=security&finding=x')
    expect(parseTaxonomyPath(params).findingSlug).toBeNull()
  })

  it('неизвестное значение area трактуется как отсутствие пути', () => {
    const params = new URLSearchParams('?area=mobile&node=security')
    expect(parseTaxonomyPath(params)).toEqual(EMPTY_PATH)
  })
})

describe('serializeTaxonomyPath', () => {
  it('собирает node точкой-разделителем', () => {
    expect(
      serializeTaxonomyPath({
        area: 'backend',
        categoryId: 'security',
        subcategoryId: 'authz',
        metricId: null,
        findingSlug: null,
      }),
    ).toEqual({ area: 'backend', node: 'security.authz', finding: null })
  })

  it('удаляет node/finding при пустом пути', () => {
    expect(serializeTaxonomyPath(EMPTY_PATH)).toEqual({ area: null, node: null, finding: null })
  })
})
