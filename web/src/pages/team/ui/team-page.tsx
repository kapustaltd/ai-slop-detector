import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
} from 'recharts'

import {
  getStats,
  loadRubric,
  loadTeam,
  type FindingView,
  type RubricBundle,
  type TeamArea,
  type TeamBundle,
  type TeamMetric,
} from '@/shared/api'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

type PageState = 'loading' | 'ready' | 'missing' | 'error'

const warningLabels: Record<string, string> = {
  suspected_prompt_injection: 'Обнаружена возможная prompt injection',
  repo_too_large: 'Репозиторий превышает лимит размера',
  file_limit_exceeded: 'Превышен лимит файлов',
  secret_redacted: 'Секреты были скрыты',
  incomplete_area: 'Область оценена неполностью',
  provider_error: 'Ошибка провайдера оценки',
}

function score(value: number | null | undefined) {
  return value == null ? '—' : value.toFixed(1)
}

type HighlightToken = { content: string; color?: string }

const languageLoaders = {
  css: () => import('shiki/langs/css.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  ruby: () => import('shiki/langs/ruby.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
} as const

type SupportedLanguage = keyof typeof languageLoaders

const highlighterFactoryPromise = import('shiki/core').then(({ createBundledHighlighter }) =>
  createBundledHighlighter({
    langs: languageLoaders,
    themes: {
      'github-dark': () => import('shiki/themes/github-dark.mjs'),
      'github-light': () => import('shiki/themes/github-light.mjs'),
    },
    engine: () =>
      import('shiki/engine/javascript').then(({ createJavaScriptRegexEngine }) =>
        createJavaScriptRegexEngine(),
      ),
  }),
)

const languageByExtension: Record<string, SupportedLanguage> = {
  css: 'css',
  go: 'go',
  html: 'html',
  java: 'java',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  kt: 'kotlin',
  md: 'markdown',
  php: 'php',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'shellscript',
  ts: 'typescript',
  tsx: 'tsx',
  yaml: 'yaml',
  yml: 'yaml',
}

function snippetLanguage(file: string) {
  const extension = file.split('.').pop()?.toLowerCase()
  return extension ? languageByExtension[extension] : undefined
}

function Snippet({ finding }: { finding: FindingView }) {
  const snippet = finding.snippet
  const lines = snippet?.split('\n') ?? []
  const language = snippetLanguage(finding.file)
  const snippetKey = `${finding.file}:${snippet ?? ''}`
  const [highlighted, setHighlighted] = useState<{
    key: string
    lines: HighlightToken[][]
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!language || !snippet) return () => undefined

    const theme = document.documentElement.classList.contains('dark')
      ? 'github-dark'
      : 'github-light'
    void highlighterFactoryPromise
      .then((createHighlighter) => createHighlighter({ langs: [language], themes: [theme] }))
      .then((highlighter) => highlighter.codeToTokens(snippet, { lang: language, theme }))
      .then(({ tokens }) => {
        if (!cancelled) setHighlighted({ key: snippetKey, lines: tokens })
      })
      .catch(() => {
        // Unknown or unavailable grammars intentionally fall back to plain text.
      })

    return () => {
      cancelled = true
    }
  }, [finding.file, language, snippet, snippetKey])

  if (!snippet) return null
  const highlightedLines = highlighted?.key === snippetKey ? highlighted.lines : null

  return (
    <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs leading-5">
      <code>
        {lines.map((line, index) => {
          const lineNumber = finding.line_start + index
          const highlighted = lineNumber >= finding.line_start && lineNumber <= finding.line_end
          const tokens = highlightedLines?.[index]
          return (
            <span
              key={`${lineNumber}-${line}`}
              className={`block ${highlighted ? 'bg-primary/10' : ''}`}
            >
              <span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
                {lineNumber}
              </span>
              {tokens
                ? tokens.map((token, tokenIndex) => (
                    <span key={`${tokenIndex}-${token.content}`} style={{ color: token.color }}>
                      {token.content}
                    </span>
                  ))
                : line || ' '}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

function FindingCard({ finding }: { finding: FindingView }) {
  const verified = finding.link_status === 'verified'
  return (
    <article className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={finding.kind === 'issue' ? 'destructive' : 'secondary'}>
          {finding.kind === 'issue' ? 'Проблема' : 'Сильная сторона'}
        </Badge>
        <Badge variant="outline">{finding.severity}</Badge>
        <span className="text-xs text-muted-foreground">
          {finding.file}:{finding.line_start}–{finding.line_end}
        </span>
      </div>
      <h5 className="mt-2 font-medium">{finding.title}</h5>
      <p className="mt-1 text-sm text-muted-foreground">{finding.explanation}</p>
      {finding.kind === 'issue' && finding.suggestion && (
        <p className="mt-2 text-sm">
          <span className="font-medium">Рекомендация:</span> {finding.suggestion}
        </p>
      )}
      {!verified && (
        <p className="mt-2 text-sm text-destructive">
          Ссылка не проверена: сниппет может быть недоступен.
        </p>
      )}
      {verified && finding.permalink && (
        <a
          className="mt-2 inline-block text-sm underline underline-offset-4"
          href={finding.permalink}
          target="_blank"
          rel="noreferrer"
        >
          Открыть участок в репозитории
        </a>
      )}
      <Snippet finding={finding} />
    </article>
  )
}

function MetricDetails({
  area,
  metric,
  rubricMetric,
  activeNode,
  kindFilter,
  severityFilter,
}: {
  area: string
  metric: TeamMetric
  rubricMetric?: RubricBundle['categories'][number]['subcategories'][number]['metrics'][number]
  activeNode: string
  kindFilter: string
  severityFilter: string
}) {
  const node = `${area}/${metric.id}`
  const findings = metric.findings.filter((finding) => {
    const kindMatches = kindFilter === 'all' || finding.kind === kindFilter
    const severityMatches = severityFilter === 'all' || finding.severity === severityFilter
    return kindMatches && severityMatches
  })
  return (
    <details id={node} className="rounded-lg border p-3" open={activeNode === node}>
      <summary className="cursor-pointer list-inside font-medium">
        {metric.name}{' '}
        <span className="ml-2 text-muted-foreground">
          {score(metric.score)} / {metric.max}
        </span>
      </summary>
      <div className="mt-3 space-y-3 pl-5">
        <p className="text-sm text-muted-foreground">
          {rubricMetric?.description ?? 'Описание метрики недоступно.'}
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Уверенность</dt>
            <dd>{metric.confidence}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Вывод</dt>
            <dd>{metric.summary}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Вес</dt>
            <dd>{metric.weight.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="whitespace-pre-wrap text-sm">
          <span className="font-medium">Почему:</span> {metric.rationale}
        </p>
        {rubricMetric && (
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            {(['2', '5', '8', '10'] as const).map((level) => (
              <p key={level}>
                <span className="font-medium text-foreground">{level}</span> —{' '}
                {rubricMetric.anchors[level]}
              </p>
            ))}
          </div>
        )}
        {findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">По текущим фильтрам находок нет.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((finding, index) => (
              <FindingCard
                key={`${finding.file}-${finding.line_start}-${index}`}
                finding={finding}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function AreaCharts({
  areaName,
  area,
  stats,
}: {
  areaName: string
  area: TeamArea
  stats?: {
    insufficient_data: boolean
    categories: Array<{ id: string; mean: number; median: number; count: number }>
  }
}) {
  const data = area.categories.map((category) => {
    const comparison = stats?.categories.find((item) => item.id === category.id)
    return {
      name: category.name,
      score: category.score,
      mean: comparison?.mean,
      median: comparison?.median,
    }
  })
  return (
    <section className="space-y-4 rounded-xl border p-4" aria-label={`Графики ${areaName}`}>
      <div>
        <h3 className="font-semibold">{areaName}</h3>
        <p className="text-sm text-muted-foreground">
          Баллы по категориям; итог уже рассчитан пайплайном.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-medium">Профиль команды</h4>
          <div className="h-64" aria-label={`Радар баллов ${areaName}`}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 10]} />
                <Radar
                  name="Команда"
                  dataKey="score"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.35}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-medium">Команда против среднего</h4>
          {stats?.insufficient_data !== false ? (
            <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              Недостаточно оценённых команд для сравнения.
            </p>
          ) : (
            <div className="h-64" aria-label={`Сравнение со средним ${areaName}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 10]} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" name="Команда" fill="var(--chart-2)" />
                  <Bar dataKey="mean" name="Среднее" fill="var(--chart-4)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {data.map((item) => (
          <p key={item.name}>
            <span className="font-medium">{item.name}</span>: {score(item.score)} / 10
          </p>
        ))}
      </div>
    </section>
  )
}

function AreaBreakdown({
  areaName,
  area,
  rubric,
  activeNode,
  kindFilter,
  severityFilter,
}: {
  areaName: string
  area: TeamArea
  rubric?: RubricBundle
  activeNode: string
  kindFilter: string
  severityFilter: string
}) {
  const rubricMetrics = new Map(
    (rubric?.categories ?? []).flatMap((category) =>
      category.subcategories.flatMap((subcategory) =>
        subcategory.metrics.map((metric) => [metric.id, metric] as const),
      ),
    ),
  )
  return (
    <section className="space-y-3" aria-label={`Таксономия ${areaName}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-semibold">Детализация {areaName}</h3>
        <span className="text-sm text-muted-foreground">
          {score(area.score)} / {area.max}
        </span>
      </div>
      {area.categories.map((category) => (
        <details
          key={category.id}
          id={`${areaName}/${category.id}`}
          className="rounded-xl border p-4"
          open={activeNode.startsWith(`${areaName}/${category.id}`)}
        >
          <summary className="cursor-pointer list-inside font-semibold">
            {category.name}{' '}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {score(category.score)} / 10 · вес {category.weight.toFixed(2)}
            </span>
          </summary>
          <div className="mt-3 space-y-3 pl-4">
            {category.subcategories.map((subcategory) => (
              <details
                key={subcategory.id}
                id={`${areaName}/${category.id}/${subcategory.id}`}
                className="rounded-lg bg-muted/30 p-3"
                open={activeNode.startsWith(`${areaName}/${category.id}/${subcategory.id}`)}
              >
                <summary className="cursor-pointer list-inside font-medium">
                  {subcategory.name}{' '}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {score(subcategory.score)} / 10 · вес {subcategory.weight.toFixed(2)}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 pl-4">
                  {subcategory.metrics.map((metric) => (
                    <MetricDetails
                      key={metric.id}
                      area={areaName}
                      metric={metric}
                      rubricMetric={rubricMetrics.get(metric.id)}
                      activeNode={activeNode}
                      kindFilter={kindFilter}
                      severityFilter={severityFilter}
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </section>
  )
}

export function TeamPage() {
  const { teamId } = useParams()
  const [state, setState] = useState<PageState>('loading')
  const [team, setTeam] = useState<TeamBundle | null>(null)
  const [rubrics, setRubrics] = useState<Record<string, RubricBundle>>({})
  const [searchParams, setSearchParams] = useSearchParams()
  const activeNode = searchParams.get('node') ?? ''
  const kindFilter = searchParams.get('kind') ?? 'all'
  const severityFilter = searchParams.get('severity') ?? 'all'
  const stats = getStats()

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    Promise.all([loadTeam(teamId), loadRubric('backend.v1'), loadRubric('frontend.v1')])
      .then(([loadedTeam, backend, frontend]) => {
        if (cancelled) return
        setTeam(loadedTeam)
        setRubrics({ backend: backend, frontend: frontend })
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  const findingCounts = useMemo(() => {
    const result = { strength: 0, issue: 0, info: 0, minor: 0, major: 0, critical: 0 }
    for (const area of Object.values(team?.areas ?? {})) {
      for (const category of area.categories) {
        for (const subcategory of category.subcategories) {
          for (const metric of subcategory.metrics) {
            for (const finding of metric.findings) {
              result[finding.kind] += 1
              result[finding.severity] += 1
            }
          }
        }
      }
    }
    return result
  }, [team])

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === 'all') next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next)
  }

  if (state === 'loading' && teamId)
    return (
      <main className="mx-auto max-w-6xl p-6" aria-busy="true">
        Загрузка команды…
      </main>
    )
  if (!teamId || state !== 'ready' || !team) {
    return (
      <main className="mx-auto max-w-6xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Команда {teamId}</h1>
        <p role="alert">Данные команды недоступны.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Повторить
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" to="/">
          ← К рейтингу
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{team.name}</h1>
          <Badge>{team.status === 'done' ? 'Готово' : team.status}</Badge>
          {team.partial && <Badge variant="outline">Частичная оценка</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Оценка — вспомогательная метрика, а не решение жюри.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">Итог</p>
          <p className="mt-1 text-3xl font-semibold">{score(team.total)} / 10</p>
        </div>
        {Object.entries(team.areas).map(([areaName, area]) => (
          <div key={areaName} className="rounded-xl border p-4">
            <p className="text-sm capitalize text-muted-foreground">{areaName}</p>
            <p className="mt-1 text-2xl font-semibold">
              {score(area.score)} / {area.max}
            </p>
          </div>
        ))}
      </section>

      {(team.warnings?.length ?? 0) > 0 && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <h2 className="font-semibold">Предупреждения</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {team.warnings?.map((warning) => (
              <li key={warning}>{warningLabels[warning] ?? warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Метаданные оценки</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Commit SHA</dt>
            <dd className="break-all font-mono text-xs">{team.commit_sha ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Скилл</dt>
            <dd>{team.meta?.skill_version ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Рубрики</dt>
            <dd>{team.meta?.rubric_version ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Схема</dt>
            <dd>{team.meta?.schema_version ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Модель</dt>
            <dd>{team.meta?.model ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Оценено</dt>
            <dd>
              {team.meta?.evaluated_at
                ? new Date(team.meta.evaluated_at).toLocaleString('ru-RU')
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">Находки</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">Сильные стороны: {findingCounts.strength}</Badge>
          <Badge variant="destructive">Проблемы: {findingCounts.issue}</Badge>
          <span className="text-muted-foreground">
            info {findingCounts.info} · minor {findingCounts.minor} · major {findingCounts.major} ·
            critical {findingCounts.critical}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <select
            aria-label="Тип находки"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={kindFilter}
            onChange={(event) => updateParams({ kind: event.target.value })}
          >
            <option value="all">Все типы</option>
            <option value="strength">Сильные стороны</option>
            <option value="issue">Проблемы</option>
          </select>
          <select
            aria-label="Серьёзность находки"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={severityFilter}
            onChange={(event) => updateParams({ severity: event.target.value })}
          >
            <option value="all">Любая серьёзность</option>
            <option value="info">Info</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </section>

      {Object.entries(team.areas).map(([areaName, area]) => {
        const statsArea = stats.areas.find((item) => item.area === areaName)
        return (
          <div key={areaName} className="space-y-6">
            <AreaCharts areaName={areaName} area={area} stats={statsArea} />
            <AreaBreakdown
              areaName={areaName}
              area={area}
              rubric={rubrics[areaName]}
              activeNode={activeNode}
              kindFilter={kindFilter}
              severityFilter={severityFilter}
            />
          </div>
        )
      })}
    </main>
  )
}
