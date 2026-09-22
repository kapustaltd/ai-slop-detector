import { getLeaderboardIndex } from '@/shared/api'

/**
 * Место в рейтинге и соседние команды — из уже отсортированного по `rank` индекса (005,
 * `getLeaderboardIndex`, синхронный). Ничего не пересчитывает (принцип VI): порядок берётся как
 * есть из `LeaderboardIndexBundle.teams`. Если индекс недоступен или команда в нём не найдена
 * (страница открыта напрямую по ссылке) — все поля пустые, а не исключение.
 */

export interface TeamRankContext {
  rank: number | null
  totalTeams: number
  tiedWith: string[]
  previousTeamId: string | null
  nextTeamId: string | null
}

const EMPTY_CONTEXT: TeamRankContext = {
  rank: null,
  totalTeams: 0,
  tiedWith: [],
  previousTeamId: null,
  nextTeamId: null,
}

export function teamRankContext(teamId: string): TeamRankContext {
  let index
  try {
    index = getLeaderboardIndex()
  } catch {
    return EMPTY_CONTEXT
  }

  const teams = index.teams
  const position = teams.findIndex((team) => team.team_id === teamId)
  if (position === -1) return EMPTY_CONTEXT

  const current = teams[position]
  const tiedWith =
    current.rank == null
      ? []
      : teams
          .filter((team) => team.team_id !== teamId && team.rank === current.rank)
          .map((team) => team.name)

  return {
    rank: current.rank,
    totalTeams: teams.length,
    tiedWith,
    previousTeamId: position > 0 ? teams[position - 1].team_id : null,
    nextTeamId: position < teams.length - 1 ? teams[position + 1].team_id : null,
  }
}
