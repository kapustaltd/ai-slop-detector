/**
 * Единственная точка доступа к дата-бандлу (спека 008, FR-006).
 *
 * Данные подключаются импортом на этапе сборки: рантайм-загрузки нет вовсе
 * (спека 004 FR-001, 008 FR-005). Пайплайн кладёт свежий бандл в `web/data/`,
 * после чего приложение пересобирается.
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
import type { RegistryTeam } from './registry'

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

export class BundleError extends Error {}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return JSON.parse(await response.clone().text()) as T
  } catch {
    return null
  }
}

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

/** Live API replaces the build-time snapshot when the registry service is available. */
export async function loadLeaderboardIndex(): Promise<LeaderboardIndexStub> {
  try {
    const response = await fetch('/api/bundle/index', { cache: 'no-store' })
    if (response.ok) {
      const index = (await response.json()) as LeaderboardIndexStub
      if (index.bundle_schema === SUPPORTED_BUNDLE_SCHEMA) return index
    }
  } catch {
    // The older registry service has no live-bundle route.
  }
  try {
    const registryResponse = await fetch('/api/teams', { cache: 'no-store' })
    if (registryResponse.ok) {
      const registry = (await registryResponse.json()) as RegistryTeam[]
      const staticIndex = getLeaderboardIndex()
      const fetchedAt = new Date().toISOString()
      return {
        ...staticIndex,
        built_at: fetchedAt,
        meta: { ...staticIndex.meta, built_at: fetchedAt },
        teams: registry
          .filter((team) => team.active)
          .map((team) => ({
            team_id: team.id,
            name: team.name,
            rank: null,
            total: null,
            areas: {},
            status: 'no_data' as const,
            partial: false,
          })),
      }
    }
  } catch {
    // Static-only deployments still read the build-time snapshot.
  }
  return getLeaderboardIndex()
}

/** Данные одной команды. Отдельный чанк, поэтому загрузка асинхронная. */
export async function loadTeam(teamId: string): Promise<TeamBundle> {
  let liveIndexAvailable = false
  try {
    const response = await fetch(`/api/bundle/teams/${encodeURIComponent(teamId)}`, {
      cache: 'no-store',
    })
    if (response.ok) {
      const liveTeam = await readJson<Partial<TeamBundle>>(response)
      if (liveTeam && typeof liveTeam === 'object' && 'team_id' in liveTeam) {
        return liveTeam as TeamBundle
      }
    }
    if (
      !response.ok &&
      response.status !== 404 &&
      (response.headers.get('content-type') ?? '').includes('application/json')
    )
      throw new BundleError('Не удалось загрузить оценку команды')
    const indexResponse = await fetch('/api/bundle/index', { cache: 'no-store' })
    if (indexResponse.ok) {
      const liveIndex = await readJson<{
        bundle_schema?: string
        teams?: unknown[]
      }>(indexResponse)
      liveIndexAvailable =
        liveIndex?.bundle_schema === SUPPORTED_BUNDLE_SCHEMA || Array.isArray(liveIndex?.teams)
    }
  } catch (cause) {
    if (cause instanceof BundleError) throw cause
  }
  if (liveIndexAvailable) throw new BundleError(`Оценка команды ${teamId} ещё не опубликована`)
  const loader = teamModules[`/data/teams/${teamId}.json`]
  if (!loader) {
    throw new BundleError(`В бандле нет файла команды ${teamId}`)
  }
  try {
    const module = await loader()
    const bundledTeam = (module.default ?? module) as TeamBundle
    if (bundledTeam && typeof bundledTeam === 'object' && 'team_id' in bundledTeam) {
      return bundledTeam
    }
  } catch {
    // The static JSON fallback below keeps dev servers and older static hosts resilient.
  }
  const staticResponse = await fetch(`/data/teams/${encodeURIComponent(teamId)}.json`, {
    cache: 'no-store',
  })
  if (staticResponse.ok) {
    const staticTeam = await readJson<Partial<TeamBundle>>(staticResponse)
    if (staticTeam && typeof staticTeam === 'object' && 'team_id' in staticTeam) {
      return staticTeam as TeamBundle
    }
  }
  throw new BundleError(`Не удалось прочитать данные команды ${teamId}`)
}

export async function loadRubric(rubricVersion: string): Promise<RubricBundle> {
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

export async function loadStats(): Promise<StatsBundle> {
  try {
    const response = await fetch('/api/bundle/stats', { cache: 'no-store' })
    if (response.ok) return (await response.json()) as StatsBundle
  } catch {
    // Static-only deployments use the bundled snapshot.
  }
  return getStats()
}
