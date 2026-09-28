import type { LeaderboardTeam } from '@/shared/api'
import { formatTeamCount } from '@/shared/lib'

interface LeaderboardSummaryCounts {
  complete: number
  partial: number
  failed: number
  queued: number
  running: number
}

function countTeams(teams: LeaderboardTeam[]): LeaderboardSummaryCounts {
  return teams.reduce<LeaderboardSummaryCounts>(
    (counts, team) => {
      if (team.status === 'failed') counts.failed += 1
      else if (team.status === 'no_data') counts.queued += 1
      else if (team.status === 'running') counts.running += 1
      else if (team.partial) counts.partial += 1
      else counts.complete += 1
      return counts
    },
    { complete: 0, partial: 0, failed: 0, queued: 0, running: 0 },
  )
}

function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

export function formatLeaderboardSummary(teams: LeaderboardTeam[]): string {
  const counts = countTeams(teams)
  const parts = [
    counts.complete > 0
      ? countLabel(counts.complete, 'оценена полностью', 'оценено полностью')
      : null,
    counts.partial > 0 ? countLabel(counts.partial, 'частично', 'частично') : null,
    counts.failed > 0 ? countLabel(counts.failed, 'ошибка', 'ошибок') : null,
    counts.queued > 0 ? countLabel(counts.queued, 'в очереди', 'в очереди') : null,
    counts.running > 0 ? countLabel(counts.running, 'проверяется', 'проверяются') : null,
  ].filter((part): part is string => part != null)

  return [formatTeamCount(teams.length), ...parts].join(' · ')
}
