import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

const webDir = resolve(import.meta.dirname, '..')
const rootDir = resolve(webDir, '..')
const rubricDir = resolve(rootDir, 'rubrics')
const dataDir = resolve(webDir, 'data')

const readRubric = (area) => parseYaml(readFileSync(resolve(rubricDir, `${area}.v1.yaml`), 'utf8'))

function makeMetric(metric, index, area) {
  const issue = index % 5 === 0
  return {
    id: metric.id,
    name: metric.name,
    weight: metric.weight,
    score: Number((6.5 + (index % 5) * 0.4).toFixed(1)),
    max: 10,
    confidence: index % 4 === 0 ? 'medium' : 'high',
    summary: issue ? 'Нужна доработка.' : 'Сценарий работает последовательно.',
    rationale: metric.description,
    findings: [
      {
        kind: issue ? 'issue' : 'strength',
        severity: issue ? 'minor' : 'info',
        file: area === 'frontend' ? 'src/main.tsx' : 'src/main.go',
        line_start: index + 1,
        line_end: index + 3,
        title: issue ? 'Точка для доработки' : 'Подтверждённое свойство',
        explanation: issue
          ? 'Участок можно сделать явнее и устойчивее.'
          : 'Участок показывает это свойство кода.',
        ...(issue
          ? {
              suggestion: 'Вынесите ответственность в отдельный модуль и проверьте сценарий.',
            }
          : {}),
        link_status: 'verified',
        snippet:
          area === 'frontend'
            ? 'export function renderApp() {\n  return <App />\n}'
            : 'func Run() error {\n\treturn nil\n}',
        permalink: `https://example.invalid/team-01/blob/0123456789abcdef0123456789abcdef01234567/${area === 'frontend' ? 'src/main.tsx' : 'src/main.go'}#L${index + 1}-L${index + 3}`,
      },
    ],
  }
}

function weightedScore(items) {
  return Number(items.reduce((sum, item) => sum + item.weight * item.score, 0).toFixed(2))
}

function makeArea(rubric) {
  let metricIndex = 0
  const categories = rubric.categories.map((category) => {
    const subcategories = category.subcategories.map((subcategory) => {
      const metrics = subcategory.metrics.map((metric) =>
        makeMetric(metric, metricIndex++, rubric.area),
      )
      return { ...subcategory, score: weightedScore(metrics), metrics }
    })
    return { ...category, score: weightedScore(subcategories), subcategories }
  })
  return {
    status: 'done',
    score: weightedScore(categories),
    max: rubric.scale.max,
    categories,
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const backend = readRubric('backend')
const frontend = readRubric('frontend')
const builtAt = '2026-09-21T12:00:00Z'
const backendArea = makeArea(backend)
const frontendArea = makeArea(frontend)
const total = Number(((backendArea.score + frontendArea.score) / 2).toFixed(2))
const bundleMeta = {
  bundle_schema: '0.1',
  built_at: builtAt,
  report_schema: '1.0',
  rubric_versions: ['backend.v1', 'frontend.v1'],
  skill_versions: ['1.0.0'],
  models: ['fixture-model'],
}

writeJson(resolve(dataDir, 'rubrics/backend.v1.json'), {
  ...backend,
  bundle_schema: '0.1',
  built_at: builtAt,
})
writeJson(resolve(dataDir, 'rubrics/frontend.v1.json'), {
  ...frontend,
  bundle_schema: '0.1',
  built_at: builtAt,
})
writeJson(resolve(dataDir, 'stats.json'), {
  bundle_schema: '0.1',
  built_at: builtAt,
  meta: bundleMeta,
  areas: [
    { area: 'backend', sample_size: 1, insufficient_data: true, categories: [], metrics: [] },
    { area: 'frontend', sample_size: 1, insufficient_data: true, categories: [], metrics: [] },
  ],
})
writeJson(resolve(dataDir, 'teams/team-01.json'), {
  bundle_schema: '0.1',
  built_at: builtAt,
  team_id: 'team-01',
  name: 'Команда 01',
  status: 'done',
  commit_sha: '0123456789abcdef0123456789abcdef01234567',
  total,
  partial: false,
  warnings: [],
  meta: {
    schema_version: 'evaluation.v1',
    skill_version: '1.0.0',
    rubric_version: 'backend.v1 + frontend.v1',
    model: 'fixture-model',
    evaluated_at: '2026-09-21T12:00:00Z',
  },
  areas: { backend: backendArea, frontend: frontendArea },
})

console.log(`Фикстурный bundle создан: total=${total}`)
