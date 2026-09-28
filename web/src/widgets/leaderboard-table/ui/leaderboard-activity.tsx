import { AlertCircle, CheckCircle2, CircleDashed, Clock3, LoaderCircle } from 'lucide-react'

import {
  activityStatusLabel,
  buildLeaderboardActivity,
  type LeaderboardActivityItem,
} from '../model/activity'
import type { LeaderboardTeam } from '@/shared/api'

interface LeaderboardActivityProps {
  teams: LeaderboardTeam[]
  builtAt: string
}

export function LeaderboardActivity({ teams, builtAt }: LeaderboardActivityProps) {
  const items = buildLeaderboardActivity(teams)

  return (
    <aside
      aria-labelledby="leaderboard-activity-title"
      className="dashboard-panel dashboard-activity"
    >
      <div className="dashboard-panel-heading">
        <div>
          <p className="dashboard-kicker">СОБЫТИЯ БАНДЛА</p>
          <h2 id="leaderboard-activity-title" className="dashboard-panel-title">
            Лента проверки
          </h2>
        </div>
        <span className="dashboard-status-dot" aria-hidden="true" />
      </div>
      <p className="dashboard-activity-note">
        Снимок данных от{' '}
        {new Date(builtAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {items.length > 0 ? (
        <ol className="dashboard-activity-list">
          {items.map((item) => (
            <ActivityItem key={item.id} item={item} />
          ))}
        </ol>
      ) : (
        <p className="dashboard-empty-note">События появятся после первой проверки.</p>
      )}
    </aside>
  )
}

function ActivityItem({ item }: { item: LeaderboardActivityItem }) {
  const Icon =
    item.status === 'done'
      ? CheckCircle2
      : item.status === 'partial'
        ? CircleDashed
        : item.status === 'running'
          ? LoaderCircle
          : item.status === 'failed'
            ? AlertCircle
            : Clock3

  return (
    <li className="dashboard-activity-item">
      <span className="dashboard-activity-icon" data-status={item.status}>
        <Icon aria-hidden="true" size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="dashboard-activity-team">{item.teamName}</p>
        <p className="dashboard-activity-detail">
          {item.detail} · {activityStatusLabel(item.status)}
        </p>
      </div>
      {item.score ? <span className="dashboard-activity-score">{item.score}</span> : null}
    </li>
  )
}
