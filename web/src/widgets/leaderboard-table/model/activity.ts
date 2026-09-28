import type { LeaderboardTeam } from '@/shared/api'

import { displayStatus, statusLabel, type LeaderboardStatus } from '@/entities/team'
import { formatScore } from '@/shared/lib'

export interface LeaderboardActivityItem {
  id: string
  teamName: string
  status: LeaderboardStatus
  detail: string
  score: string | null
}

export function buildLeaderboardActivity(teams: LeaderboardTeam[]): LeaderboardActivityItem[] {
  return teams.slice(0, 6).map((team) => {
    const status = displayStatus(team)
    return {
      id: team.team_id,
      teamName: team.name,
      status,
      detail: activityDetail(status),
      score: team.total == null ? null : formatScore(team.total),
    }
  })
}

function activityDetail(status: LeaderboardStatus): string {
  if (status === 'done') return 'проверка завершена'
  if (status === 'partial') return 'оценка опубликована частично'
  if (status === 'running') return 'проверка выполняется'
  if (status === 'failed') return 'проверка завершилась с ошибкой'
  return 'ожидает проверки'
}

export function activityStatusLabel(status: LeaderboardStatus): string {
  return statusLabel(status)
}
