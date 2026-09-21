/**
 * Единственная точка доступа к дата-бандлу (спека 008, FR-006).
 *
 * Данные подключаются импортом на этапе сборки: индекс попадает в основной бандл,
 * файл каждой команды — в отдельный чанк и грузится только при открытии её страницы
 * (FR-005, FR-007). Если когда-нибудь понадобится загрузка в рантайме, правится
 * только этот файл.
 *
 * ВРЕМЕННО: типы объявлены здесь вручную, потому что схемы контракта 001 и бандла 004
 * ещё не реализованы. При реализации 001/004 их заменяют сгенерированные типы
 * (FR-008), а эти определения удаляются.
 */

export type BundleSchemaVersion = string

/** Поддерживаемая приложением версия схемы бандла (FR-010). */
export const SUPPORTED_BUNDLE_SCHEMA = '0.1'

/** ВРЕМЕННЫЙ тип. Заменяется сгенерированным из схемы 004. */
export interface LeaderboardIndexStub {
  bundle_schema: BundleSchemaVersion
  built_at: string
  teams: Array<{
    team_id: string
    name: string
    rank: number | null
    total: number | null
    status: string
  }>
}

const indexModules = import.meta.glob<{ default: LeaderboardIndexStub }>('/data/index.json', {
  eager: true,
})

const teamModules = import.meta.glob<{ default: unknown }>('/data/teams/*.json')

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
export async function loadTeam(teamId: string): Promise<unknown> {
  const loader = teamModules[`/data/teams/${teamId}.json`]
  if (!loader) {
    throw new BundleError(`В бандле нет файла команды ${teamId}`)
  }
  return (await loader()).default
}
