/**
 * Единственная точка доступа к дата-бандлу (спека 008, FR-006).
 *
 * Данные подключаются импортом на этапе сборки: индекс попадает в основной бандл,
 * файл каждой команды — в отдельный чанк и грузится только при открытии её страницы
 * (FR-005, FR-007). Если когда-нибудь понадобится загрузка в рантайме, правится
 * только этот файл.
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

/** Данные одной команды. Отдельный чанк, поэтому загрузка асинхронная. */
export async function loadTeam(teamId: string): Promise<TeamBundle> {
  const loader = teamModules[`/data/teams/${teamId}.json`]
  if (!loader) {
    throw new BundleError(`В бандле нет файла команды ${teamId}`)
  }
  return (await loader()).default
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
