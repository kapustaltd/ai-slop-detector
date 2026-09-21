import { Link } from 'react-router-dom'

import { getLeaderboardIndex } from '@/shared/api'
import { formatScore } from '@/shared/lib'

/**
 * Заглушка страницы рейтинга: показывает, что каркас работает на фикстурном бандле.
 * Настоящая таблица с сортировкой, фильтрами и статусами — предмет спеки 005.
 */
export function LeaderboardPage() {
  const index = getLeaderboardIndex()

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Рейтинг команд</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Бандл собран {new Date(index.built_at).toLocaleString('ru-RU')}
      </p>

      <ul className="mt-6 divide-y">
        {index.teams.map((team) => (
          <li key={team.team_id} className="flex items-center justify-between py-3">
            <Link className="underline underline-offset-4" to={`/team/${team.team_id}`}>
              {team.name}
            </Link>
            <span className="text-sm tabular-nums">{formatScore(team.total)}</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
