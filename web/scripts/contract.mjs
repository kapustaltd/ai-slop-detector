import { readFile, readdir, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import Ajv from 'ajv'
import { compile } from 'json-schema-to-typescript'
import { parse as parseYaml } from 'yaml'

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_DIR = resolve(WEB_DIR, '..')
const SCHEMA_DIR = join(ROOT_DIR, 'schemas')
const RUBRIC_DIR = join(ROOT_DIR, 'rubrics')
const FIXTURE_DIR = join(ROOT_DIR, 'fixtures', 'evaluation')
const GENERATED_TS = join(WEB_DIR, 'src', 'shared', 'api', 'generated', 'evaluation-report.ts')
const GENERATED_BUNDLE_TS = join(WEB_DIR, 'src', 'shared', 'api', 'generated', 'data-bundle.ts')
const GENERATED_GO = join(ROOT_DIR, 'agent', 'internal', 'contract', 'evaluation_report.gen.go')
const GENERATED_REVIEW_GO = join(ROOT_DIR, 'agent', 'internal', 'contract', 'review_output.gen.go')

const REPORT_SCHEMA_PATH = join(SCHEMA_DIR, 'evaluation-report.schema.json')
const REVIEW_SCHEMA_PATH = join(SCHEMA_DIR, 'review-output.schema.json')
const RUBRIC_SCHEMA_PATH = join(SCHEMA_DIR, 'rubric.schema.json')
const BUNDLE_SCHEMA_PATHS = {
  index: join(SCHEMA_DIR, 'data-bundle-index.schema.json'),
  team: join(SCHEMA_DIR, 'data-bundle-team.schema.json'),
  stats: join(SCHEMA_DIR, 'data-bundle-stats.schema.json'),
}
const RUBRIC_FILES = {
  backend: join(RUBRIC_DIR, 'backend.v1.yaml'),
  frontend: join(RUBRIC_DIR, 'frontend.v1.yaml'),
}

const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addFormat('date-time', {
  type: 'string',
  validate: (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
})
ajv.addFormat('uri', { type: 'string', validate: (value) => /^https?:\/\//.test(value) })

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const readRubric = (area) => parseYaml(readFileSync(RUBRIC_FILES[area], 'utf8'))

function formatErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '/'} ${error.message}`).join('; ')
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function sumWeights(items, label) {
  const sum = items.reduce((total, item) => total + item.weight, 0)
  assert(Math.abs(sum - 1) <= 0.001, `${label}: сумма весов ${sum.toFixed(6)} не равна 1.0`)
  return sum
}

function flattenMetrics(rubric) {
  return rubric.categories.flatMap((category) =>
    category.subcategories.flatMap((subcategory) => subcategory.metrics),
  )
}

function validateRubric(rubric, schemaValidator, area) {
  if (!schemaValidator(rubric)) fail(`rubric ${area}: ${formatErrors(schemaValidator.errors)}`)
  assert(rubric.area === area, `rubric ${area}: area должен быть ${area}`)
  assert(rubric.rubric_version === `${area}.v1`, `rubric ${area}: неверная версия рубрики`)
  assert(
    Math.abs(rubric.area_weights.backend + rubric.area_weights.frontend - 1) <= 0.001,
    `rubric ${area}: веса областей не суммируются в 1.0`,
  )
  sumWeights(rubric.categories, `rubric ${area}/categories`)

  const categoryIds = new Set()
  const metricIds = new Set()
  for (const category of rubric.categories) {
    assert(!categoryIds.has(category.id), `rubric ${area}: повтор категории ${category.id}`)
    categoryIds.add(category.id)
    sumWeights(category.subcategories, `rubric ${area}/${category.id}/subcategories`)
    const subcategoryIds = new Set()
    for (const subcategory of category.subcategories) {
      assert(
        !subcategoryIds.has(subcategory.id),
        `rubric ${area}/${category.id}: повтор подкатегории ${subcategory.id}`,
      )
      subcategoryIds.add(subcategory.id)
      sumWeights(subcategory.metrics, `rubric ${area}/${subcategory.id}/metrics`)
      for (const metric of subcategory.metrics) {
        assert(!metricIds.has(metric.id), `rubric ${area}: повтор метрики ${metric.id}`)
        metricIds.add(metric.id)
        assert(
          Object.keys(metric.anchors).sort().join(',') === '10,2,5,8',
          `rubric ${area}/${metric.id}: нужны якоря 2, 5, 8 и 10`,
        )
      }
    }
  }

  const expectedCount = area === 'backend' ? 20 : 17
  assert(
    metricIds.size === expectedCount,
    `rubric ${area}: ожидалось ${expectedCount} метрик, получено ${metricIds.size}`,
  )
  return metricIds
}

function proposalMetricIds(area) {
  const source = readFileSync(join(ROOT_DIR, 'docs', 'rubric-proposal.md'), 'utf8')
  const startMarker = area === 'backend' ? '## 2. Backend' : '## 3. Frontend'
  const endMarker = area === 'backend' ? '## 3. Frontend' : '## 4. Агрегация'
  const section = source.slice(source.indexOf(startMarker), source.indexOf(endMarker))
  return new Set([...section.matchAll(/`([a-z][a-z0-9_]+)` —/g)].map((match) => match[1]))
}

function validateProposalAlignment(rubric, metricIds, area) {
  const expected = proposalMetricIds(area)
  assert(
    expected.size === metricIds.size,
    `rubric ${area}: proposal содержит ${expected.size} метрик`,
  )
  for (const id of expected)
    assert(metricIds.has(id), `rubric ${area}: отсутствует метрика из proposal: ${id}`)
}

function validateReport(report, reportValidator, rubric, metricIds, sourceName) {
  if (!reportValidator(report)) fail(`${sourceName}: ${formatErrors(reportValidator.errors)}`)
  const { meta, metrics } = report
  assert(meta.area === rubric.area, `${sourceName}: область отчёта не совпадает с рубрикой`)
  assert(
    meta.rubric_version === rubric.rubric_version,
    `${sourceName}: версия рубрики не совпадает`,
  )
  const ids = metrics.map((metric) => metric.id)
  assert(new Set(ids).size === ids.length, `${sourceName}: повторяющиеся metric id`)
  assert(ids.length === metricIds.size, `${sourceName}: неполный набор метрик`)
  for (const metric of metrics) {
    assert(metricIds.has(metric.id), `${sourceName}: неизвестная метрика ${metric.id}`)
    assert(metric.max === rubric.scale.max, `${sourceName}/${metric.id}: неверный max`)
    assert(metric.score <= metric.max, `${sourceName}/${metric.id}: score больше max`)
    for (const finding of metric.findings) {
      assert(
        finding.line_end >= finding.line_start,
        `${sourceName}/${metric.id}: line_end меньше line_start`,
      )
      assert(
        !finding.file.includes('\\'),
        `${sourceName}/${metric.id}: путь содержит обратный слеш`,
      )
      assert(!finding.file.startsWith('/'), `${sourceName}/${metric.id}: абсолютный путь`)
      assert(!finding.file.split('/').includes('..'), `${sourceName}/${metric.id}: выход через ..`)
    }
  }
}

function reportTemplate(rubric, scores = {}) {
  const metrics = flattenMetrics(rubric).map((metric, index) => ({
    id: metric.id,
    score: scores[metric.id] ?? Number((6 + (index % 4) * 0.5).toFixed(1)),
    max: rubric.scale.max,
    confidence: 'medium',
    summary: `Оценка по метрике «${metric.name}».`,
    rationale: `Оценка основана на проверке свойства: ${metric.description}`,
    findings: [
      {
        kind: 'strength',
        severity: 'info',
        file: 'src/main.go',
        line_start: index + 1,
        line_end: index + 1,
        title: `Наблюдение по метрике «${metric.name}»`,
        explanation: `В репозитории есть участок, относящийся к метрике «${metric.name}».`,
      },
    ],
  }))
  return {
    meta: {
      schema_version: 'evaluation.v1',
      team_id: 'fixture-team',
      area: rubric.area,
      repo: 'https://example.invalid/fixture-team/repository',
      commit_sha: '0123456789abcdef0123456789abcdef01234567',
      skill_version: '1.0.0',
      rubric_version: rubric.rubric_version,
      model: 'fixture-model',
      evaluated_at: '2026-09-21T12:00:00Z',
    },
    metrics,
    overall_comment: 'Фикстурный отчёт для разработки и проверки контракта.',
    warnings: [],
  }
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function writeFixtures(rubrics) {
  const validDir = join(FIXTURE_DIR, 'valid')
  const invalidDir = join(FIXTURE_DIR, 'invalid')
  await mkdir(validDir, { recursive: true })
  await mkdir(invalidDir, { recursive: true })

  const valid = [
    [
      'backend-strong.json',
      reportTemplate(rubrics.backend, { layer_separation: 9, test_quality: 8.5 }),
    ],
    [
      'backend-medium.json',
      reportTemplate(rubrics.backend, { layer_separation: 6, test_quality: 5.5 }),
    ],
    [
      'frontend-strong.json',
      reportTemplate(rubrics.frontend, { component_decomposition: 8.5, responsiveness: 9 }),
    ],
  ]
  for (const [name, report] of valid) await writeFile(join(validDir, name), json(report))

  const invalidBase = reportTemplate(rubrics.backend)
  const invalid = [
    {
      name: 'missing-commit-sha.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        delete report.meta.commit_sha
        return report
      })(),
      reason: 'Ожидается ошибка: отсутствует обязательное поле meta.commit_sha.',
    },
    {
      name: 'score-over-max.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        report.metrics[0].score = 11
        return report
      })(),
      reason: 'Ожидается ошибка: score превышает max и верхнюю границу шкалы.',
    },
    {
      name: 'empty-findings.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        report.metrics[0].findings = []
        return report
      })(),
      reason: 'Ожидается ошибка: у метрики отсутствует обязательная находка.',
    },
    {
      name: 'reversed-lines.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        report.metrics[0].findings[0].line_start = 20
        report.metrics[0].findings[0].line_end = 19
        return report
      })(),
      reason: 'Ожидается ошибка: line_end меньше line_start.',
    },
    {
      name: 'absolute-path.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        report.metrics[0].findings[0].file = '/tmp/outside-repository.go'
        return report
      })(),
      reason: 'Ожидается ошибка: путь находки абсолютный.',
    },
    {
      name: 'unknown-metric.json',
      report: (() => {
        const report = structuredClone(invalidBase)
        report.metrics[0].id = 'unknown_metric'
        return report
      })(),
      reason: 'Ожидается ошибка: id метрики отсутствует в backend.v1.',
    },
  ]
  for (const fixture of invalid) {
    await writeFile(join(invalidDir, fixture.name), json(fixture.report))
    await writeFile(
      join(invalidDir, fixture.name.replace('.json', '.reason.md')),
      `${fixture.reason}\n`,
    )
  }
}

const GO_INITIALISMS = new Map([
  ['api', 'API'],
  ['id', 'ID'],
  ['sha', 'SHA'],
  ['url', 'URL'],
])

const pascal = (value) =>
  value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => GO_INITIALISMS.get(part.toLowerCase()) ?? part[0].toUpperCase() + part.slice(1))
    .join('')

function namespaceTypes(source, prefix, names) {
  return names.reduce(
    (result, name) => result.replace(new RegExp(`\\b${name}\\b`, 'g'), `${prefix}${name}`),
    source,
  )
}

function goType(schema, required = true) {
  if (schema.$ref) return pascal(schema.$ref.split('/').at(-1))
  if (schema.type === 'array') return `[]${goType(schema.items)}`
  if (schema.type === 'string') return 'string'
  if (schema.type === 'integer') return 'int'
  if (schema.type === 'number') return 'float64'
  if (schema.const !== undefined || schema.enum)
    return typeof schema.const === 'number' ? 'float64' : 'string'
  return 'any'
}

function renderGo(schema, rootName = 'EvaluationReport') {
  const defs = schema.$defs ?? schema.definitions ?? {}
  const renderObject = (name, objectSchema) => {
    const required = new Set(objectSchema.required ?? [])
    const fields = Object.entries(objectSchema.properties ?? {}).map(([key, property]) => {
      const fieldType = goType(property, required.has(key))
      return (
        '\t' +
        pascal(key) +
        ' ' +
        fieldType +
        ' `json:"' +
        key +
        (required.has(key) ? '' : ',omitempty') +
        '"`'
      )
    })
    return `type ${name} struct {\n${fields.join('\n')}\n}`
  }
  const blocks = [renderObject(rootName, schema)]
  for (const [name, definition] of Object.entries(defs))
    blocks.push(renderObject(pascal(name), definition))
  const source = `// Code generated by web/scripts/contract.mjs; DO NOT EDIT.\n\npackage contract\n\n${blocks.join('\n\n')}\n`
  return execFileSync('gofmt', [], { input: source, encoding: 'utf8' })
}

async function renderTypes() {
  const schema = readJson(REPORT_SCHEMA_PATH)
  const reviewSchema = readJson(REVIEW_SCHEMA_PATH)
  const ts = await compile(schema, 'EvaluationReport', {
    bannerComment: '// Code generated by web/scripts/contract.mjs; DO NOT EDIT.\n',
  })
  const bundleTypes = []
  for (const [name, path] of [
    ['LeaderboardIndex', BUNDLE_SCHEMA_PATHS.index],
    ['TeamBundle', BUNDLE_SCHEMA_PATHS.team],
    ['StatsBundle', BUNDLE_SCHEMA_PATHS.stats],
    ['RubricBundle', RUBRIC_SCHEMA_PATH],
  ]) {
    const generated = await compile(readJson(path), name, { bannerComment: '' })
    const prefix =
      name === 'TeamBundle'
        ? 'Team'
        : name === 'StatsBundle'
          ? 'Stats'
          : name === 'RubricBundle'
            ? 'Rubric'
            : ''
    const definitions =
      prefix === 'Team'
        ? ['Meta', 'Area', 'Category', 'Subcategory', 'Metric', 'Finding']
        : prefix === 'Stats'
          ? ['Node']
          : prefix === 'Rubric'
            ? ['Category', 'Subcategory', 'Metric']
            : []
    bundleTypes.push(namespaceTypes(generated, prefix, definitions))
  }
  return {
    ts,
    go: renderGo(schema),
    reviewGo: renderGo(reviewSchema, 'ReviewOutput'),
    bundleTs: `// Code generated by web/scripts/contract.mjs; DO NOT EDIT.\n\n${bundleTypes.join('\n')}`,
  }
}

async function generate() {
  const rubrics = { backend: readRubric('backend'), frontend: readRubric('frontend') }
  const { ts, go, reviewGo, bundleTs } = await renderTypes()
  await mkdir(dirname(GENERATED_TS), { recursive: true })
  await mkdir(dirname(GENERATED_GO), { recursive: true })
  await writeFile(GENERATED_TS, ts)
  await writeFile(GENERATED_BUNDLE_TS, bundleTs)
  await writeFile(GENERATED_GO, go)
  await writeFile(GENERATED_REVIEW_GO, reviewGo)
  await writeFixtures(rubrics)
}

async function compareGenerated() {
  const { ts, go, reviewGo, bundleTs } = await renderTypes()
  for (const [path, expected] of [
    [GENERATED_TS, ts],
    [GENERATED_BUNDLE_TS, bundleTs],
    [GENERATED_GO, go],
    [GENERATED_REVIEW_GO, reviewGo],
  ]) {
    try {
      await access(path)
    } catch {
      fail(`Не найден сгенерированный файл: ${path}`)
    }
    const actual = await readFile(path, 'utf8')
    assert(
      actual === expected,
      `Сгенерированный файл устарел: ${path}. Запустите npm run contract:generate.`,
    )
  }
}

function validateBundleFixtures(validators, rubricSchemaValidator) {
  const index = readJson(join(WEB_DIR, 'data', 'index.json'))
  const team = readJson(join(WEB_DIR, 'data', 'teams', 'team-01.json'))
  const stats = readJson(join(WEB_DIR, 'data', 'stats.json'))
  for (const [name, value] of [
    ['index', index],
    ['team-01', team],
    ['stats', stats],
  ]) {
    const validator = validators[name === 'team-01' ? 'team' : name]
    if (!validator(value)) fail(`bundle ${name}: ${formatErrors(validator.errors)}`)
  }
  const indexText = JSON.stringify(index)
  assert(
    !/findings|snippet|rationale|explanation/.test(indexText),
    'bundle index must not contain report details',
  )
  for (const area of ['backend', 'frontend']) {
    const rubric = readJson(join(WEB_DIR, 'data', 'rubrics', `${area}.v1.json`))
    const metricIds = validateRubric(rubric, rubricSchemaValidator, area)
    validateProposalAlignment(rubric, metricIds, area)
    assert(rubric.bundle_schema === '0.1', `bundle rubric ${area}: missing bundle_schema`)
    assert(
      typeof rubric.built_at === 'string' && rubric.built_at.length > 0,
      `bundle rubric ${area}: missing built_at`,
    )
  }
}

async function validateAll() {
  const reportSchema = readJson(REPORT_SCHEMA_PATH)
  const reviewSchema = readJson(REVIEW_SCHEMA_PATH)
  const rubricSchema = readJson(RUBRIC_SCHEMA_PATH)
  const validateReportSchema = ajv.compile(reportSchema)
  ajv.compile(reviewSchema)
  const validateRubricSchema = ajv.compile(rubricSchema)
  const validateBundleSchemas = Object.fromEntries(
    Object.entries(BUNDLE_SCHEMA_PATHS).map(([name, path]) => [name, ajv.compile(readJson(path))]),
  )
  const rubrics = { backend: readRubric('backend'), frontend: readRubric('frontend') }
  const metricSets = {}
  for (const area of ['backend', 'frontend']) {
    metricSets[area] = validateRubric(rubrics[area], validateRubricSchema, area)
    validateProposalAlignment(rubrics[area], metricSets[area], area)
  }
  validateBundleFixtures(validateBundleSchemas, validateRubricSchema)

  const validFiles = (await readdir(join(FIXTURE_DIR, 'valid'))).filter((file) =>
    file.endsWith('.json'),
  )
  assert(validFiles.length >= 3, 'Нужно минимум три валидные фикстуры')
  for (const file of validFiles) {
    const report = readJson(join(FIXTURE_DIR, 'valid', file))
    const area = report.meta.area
    validateReport(report, validateReportSchema, rubrics[area], metricSets[area], `valid/${file}`)
  }

  const invalidFiles = (await readdir(join(FIXTURE_DIR, 'invalid'))).filter((file) =>
    file.endsWith('.json'),
  )
  assert(invalidFiles.length >= 3, 'Нужно минимум три невалидные фикстуры')
  for (const file of invalidFiles) {
    const report = readJson(join(FIXTURE_DIR, 'invalid', file))
    const reasonPath = join(FIXTURE_DIR, 'invalid', file.replace('.json', '.reason.md'))
    assert(existsSync(reasonPath), `Для ${file} отсутствует файл с ожидаемой причиной`)
    assert(
      readFileSync(reasonPath, 'utf8').trim().length > 0,
      `Для ${file} пустая ожидаемая причина`,
    )
    let rejected = false
    try {
      const area = report.meta?.area ?? 'backend'
      validateReport(
        report,
        validateReportSchema,
        rubrics[area],
        metricSets[area],
        `invalid/${file}`,
      )
    } catch {
      rejected = true
    }
    assert(rejected, `Невалидная фикстура неожиданно прошла: ${file}`)
  }
  return { valid: validFiles.length, invalid: invalidFiles.length }
}

async function main() {
  const command = process.argv[2] ?? 'check'
  if (command === 'generate') {
    await generate()
    console.log('Контрактные типы и фикстуры сгенерированы.')
    return
  }
  if (command === 'validate') {
    const result = await validateAll()
    console.log(
      `Контракт валиден: ${result.valid} валидных и ${result.invalid} невалидных фикстур.`,
    )
    return
  }
  if (command === 'check') {
    const result = await validateAll()
    await compareGenerated()
    console.log(
      `Проверка контракта пройдена: ${result.valid} валидных и ${result.invalid} невалидных фикстур.`,
    )
    return
  }
  fail(`Неизвестная команда ${command}. Используйте generate, validate или check.`)
}

main().catch((error) => {
  console.error(`Ошибка проверки контракта: ${error.stack ?? error.message}`)
  process.exitCode = 1
})
