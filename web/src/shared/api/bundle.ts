/**
 * Единственная точка доступа к дата-бандлу (спека 008, FR-006).
 *
 * Статический бандл остаётся мгновенным fallback, а production web runner
 * публикует свежие результаты через тот же JSON-контракт в /api/v1/bundle.
 *
 * Типы дата-бандла генерируются из JSON Schema 004 скриптом contract:generate.
 */

import type {
  BundleStatistics,
  EvaluationRubric,
  LeaderboardIndexBundle,
  TeamArea as GeneratedTeamArea,
  TeamBundle as GeneratedTeamBundle,
  TeamCategory as GeneratedTeamCategory,
  TeamFinding,
  TeamMetric as GeneratedTeamMetric,
  TeamSubcategory as GeneratedTeamSubcategory,
} from './generated/data-bundle'

export type BundleSchemaVersion = string

/** Поддерживаемая приложением версия схемы бандла (FR-010). */
export const SUPPORTED_BUNDLE_SCHEMA = '0.1'

export type EvaluationStatus = 'done' | 'failed' | 'no_data' | 'running'

export type LeaderboardIndexStub = LeaderboardIndexBundle
export type LeaderboardTeam = LeaderboardIndexBundle['teams'][number]
export type FindingView = TeamFinding
export type TeamMetric = GeneratedTeamMetric
export type TeamSubcategory = GeneratedTeamSubcategory
export type TeamCategory = GeneratedTeamCategory
export type TeamArea = GeneratedTeamArea
export type TeamBundle = GeneratedTeamBundle
export type RubricMetric = import('./generated/data-bundle').RubricMetric
export type RubricSubcategory = import('./generated/data-bundle').RubricSubcategory
export type RubricCategory = import('./generated/data-bundle').RubricCategory
export type RubricBundle = EvaluationRubric
export type StatsBundle = BundleStatistics

const indexModules = import.meta.glob<{ default: LeaderboardIndexStub }>('/data/index.json', {
  eager: true,
})

const teamModules = import.meta.glob<{ default: TeamBundle }>('/data/teams/*.json')
const rubricModules = import.meta.glob<{ default: RubricBundle }>('/data/rubrics/*.json')
const statsModules = import.meta.glob<{ default: StatsBundle }>('/data/stats.json', { eager: true })

const runnerApiBase = (import.meta.env.VITE_RUNNER_API_BASE as string | undefined) ?? '/api/v1'
const runtimeBundleBase = `${runnerApiBase.replace(/\/$/, '')}/bundle`

export class BundleError extends Error {}

/** Индекс рейтинга. Доступен синхронно: он всегда в основном чанке. */
export function getLeaderboardIndex(): LeaderboardIndexStub {
  const mod = Object.values(indexModules)[0]
  if (!mod) {
    throw new BundleError('Дата-бандл не найден: ожидается web/data/index.json')
  }
  const index = mod.default
  if (index.bundle_schema !== SUPPORTED_BUNDLE_SCHEMA) {
    throw new BundleError(
      `Версия схемы бандла ${index.bundle_schema} не поддерживается: приложение понимает ${SUPPORTED_BUNDLE_SCHEMA}`,
    )
  }
  return index
}

async function loadRuntimeAsset<T>(asset: string): Promise<T> {
  const response = await fetch(`${runtimeBundleBase}/${asset}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new BundleError(`Динамический дата-бандл недоступен (${response.status})`)
  return (await response.json()) as T
}

/** Свежий индекс web runner с безопасным fallback на статический бандл. */
export async function loadLeaderboardIndex(): Promise<LeaderboardIndexStub> {
  try {
    const index = await loadRuntimeAsset<LeaderboardIndexStub>('index.json')
    if (index.bundle_schema !== SUPPORTED_BUNDLE_SCHEMA) {
      throw new BundleError(`Версия схемы бандла ${index.bundle_schema} не поддерживается`)
    }
    return index
  } catch {
    return getLeaderboardIndex()
  }
}

/** Данные одной команды. Отдельный чанк, поэтому загрузка асинхронная. */
export async function loadTeam(teamId: string): Promise<TeamBundle> {
  try {
    return await loadRuntimeAsset<TeamBundle>(`teams/${encodeURIComponent(teamId)}.json`)
  } catch {
    // A team from the shipped bundle remains available before the first live run.
  }
  const loader = teamModules[`/data/teams/${teamId}.json`]
  if (!loader) {
    throw new BundleError(`В бандле нет файла команды ${teamId}`)
  }
  return (await loader()).default
}

export async function loadRubric(rubricVersion: string): Promise<RubricBundle> {
  try {
    return await loadRuntimeAsset<RubricBundle>(`rubrics/${encodeURIComponent(rubricVersion)}.json`)
  } catch {
    // Fall back to the rubric embedded at build time.
  }
  const loader = rubricModules[`/data/rubrics/${rubricVersion}.json`]
  if (!loader) throw new BundleError(`В бандле нет рубрики ${rubricVersion}`)
  return (await loader()).default
}

export function getStats(): StatsBundle {
  const mod = Object.values(statsModules)[0]
  return (
    mod?.default ?? {
      bundle_schema: SUPPORTED_BUNDLE_SCHEMA,
      built_at: '',
      meta: {
        bundle_schema: SUPPORTED_BUNDLE_SCHEMA,
        built_at: '',
        report_schema: '1.0',
        rubric_versions: [],
        skill_versions: [],
        models: [],
      },
      areas: [],
    }
  )
}
