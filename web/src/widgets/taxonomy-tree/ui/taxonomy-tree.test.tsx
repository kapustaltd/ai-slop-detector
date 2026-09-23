import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import type { RubricBundle, TeamArea } from '@/shared/api'

import { DEFAULT_FINDINGS_FILTER } from '../model/findings-filter'
import { EMPTY_PATH, type TaxonomyPath } from '../model/taxonomy-path'
import { TaxonomyTree } from './taxonomy-tree'

function area(): TeamArea {
  return {
    status: 'done',
    score: 6.2,
    max: 10,
    categories: [
      {
        id: 'security',
        name: 'Безопасность',
        weight: 0.13,
        score: 6.2,
        subcategories: [
          {
            id: 'authz',
            name: 'Аутентификация и авторизация',
            weight: 0.6,
            score: 5.4,
            metrics: [
              {
                id: 'resource-level',
                name: 'Проверка прав на уровне ресурса',
                weight: 0.4,
                score: 4.0,
                max: 10,
                confidence: 'low',
                summary: 'Краткий вывод по метрике.',
                rationale: 'Развёрнутое обоснование.',
                findings: [
                  {
                    kind: 'issue',
                    severity: 'minor',
                    file: 'src/a.ts',
                    line_start: 1,
                    line_end: 2,
                    title: 'Незначительная находка',
                    explanation: 'e1',
                  },
                  {
                    kind: 'issue',
                    severity: 'major',
                    file: 'src/b.ts',
                    line_start: 3,
                    line_end: 4,
                    title: 'Серьёзная находка',
                    explanation: 'e2',
                    permalink: 'https://x',
                    link_status: 'verified',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

function rubric(): RubricBundle {
  return {
    schema_version: 'rubric.v1',
    rubric_version: '1.4',
    area: 'backend',
    scale: { max: 10, anchors: [2, 5, 8, 10] },
    area_weights: { backend: 0.5, frontend: 0.5 },
    categories: [
      {
        id: 'security',
        name: 'Безопасность',
        weight: 0.13,
        subcategories: [
          {
            id: 'authz',
            name: 'Аутентификация и авторизация',
            weight: 0.6,
            metrics: [
              {
                id: 'resource-level',
                name: 'Проверка прав на уровне ресурса',
                weight: 0.4,
                description: 'Описание метрики.',
                anchors: { '2': 'a2', '5': 'a5', '8': 'a8', '10': 'a10' },
              },
            ],
          },
        ],
      },
    ],
  }
}

function Harness({ initial }: { initial: TaxonomyPath }) {
  const [path, setPath] = useState(initial)
  return (
    <TaxonomyTree
      areaName="backend"
      area={area()}
      rubric={rubric()}
      path={path}
      onPathChange={setPath}
      findingsFilter={DEFAULT_FINDINGS_FILTER}
      commitSha="a91b73e"
    />
  )
}

describe('TaxonomyTree', () => {
  it('свёрнуто по умолчанию — подкатегории не видны', () => {
    render(<Harness initial={EMPTY_PATH} />)

    expect(screen.getByText('Безопасность')).toBeInTheDocument()
    expect(screen.queryByText('Аутентификация и авторизация')).not.toBeInTheDocument()
  })

  it('раскрывает категорию → подкатегорию → метрику по клику (US2 #1)', async () => {
    const user = userEvent.setup()
    render(<Harness initial={EMPTY_PATH} />)

    await user.click(screen.getByText('Безопасность'))
    await user.click(screen.getByText('Аутентификация и авторизация'))
    await user.click(screen.getByText('Проверка прав на уровне ресурса'))

    expect(screen.getByText('Краткий вывод по метрике.')).toBeInTheDocument()
    expect(screen.getByText('Развёрнутое обоснование.')).toBeInTheDocument()
  })

  it('показывает якоря рубрики нужной версии на раскрытой метрике (US2 #2)', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={{
          area: 'backend',
          categoryId: 'security',
          subcategoryId: 'authz',
          metricId: 'resource-level',
          findingSlug: null,
        }}
      />,
    )

    expect(screen.getByText('a2')).toBeInTheDocument()
    expect(screen.getByText('a10')).toBeInTheDocument()
    void user
  })

  it('по умолчанию раскрыта самая серьёзная находка, остальные — строкой (DESIGN.md)', () => {
    render(
      <Harness
        initial={{
          area: 'backend',
          categoryId: 'security',
          subcategoryId: 'authz',
          metricId: 'resource-level',
          findingSlug: null,
        }}
      />,
    )

    expect(screen.getByText('e2')).toBeInTheDocument()
    expect(screen.queryByText('e1')).not.toBeInTheDocument()
    expect(screen.getByText('Незначительная находка')).toBeInTheDocument()
  })

  it('верифицированная ссылка показывает кнопку «Открыть на SHA» (US2 #4)', () => {
    render(
      <Harness
        initial={{
          area: 'backend',
          categoryId: 'security',
          subcategoryId: 'authz',
          metricId: 'resource-level',
          findingSlug: null,
        }}
      />,
    )

    expect(screen.getByRole('link', { name: /Открыть на a91b73e/ })).toHaveAttribute(
      'href',
      'https://x',
    )
  })

  it('«Свернуть всё» возвращает дерево в исходное состояние', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={{
          area: 'backend',
          categoryId: 'security',
          subcategoryId: 'authz',
          metricId: 'resource-level',
          findingSlug: null,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Свернуть всё' }))
    expect(screen.queryByText('Аутентификация и авторизация')).not.toBeInTheDocument()
  })
})
