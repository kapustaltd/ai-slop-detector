import { AlertCircle, CheckCircle2, Clock3, CircleDashed, LoaderCircle } from 'lucide-react'

import { displayStatus, statusLabel, type LeaderboardStatus } from '@/entities/team'
import type { LeaderboardTeam } from '@/shared/api'

interface LeaderboardStatusBoardProps {
  teams: LeaderboardTeam[]
  activeStatus: LeaderboardStatus | 'all'
  onStatusChange: (status: LeaderboardStatus | 'all') => void
}

const items: {
  status: LeaderboardStatus
  icon: typeof LoaderCircle
  tone: string
}[] = [
  {
    status: 'running',
    icon: LoaderCircle,
    tone: 'text-brand',
  },
  {
    status: 'no_data',
    icon: Clock3,
    tone: 'text-fg-muted',
  },
  {
    status: 'done',
    icon: CheckCircle2,
    tone: 'text-sev-strength-fg',
  },
  {
    status: 'partial',
    icon: CircleDashed,
    tone: 'text-sev-info-fg',
  },
  {
    status: 'failed',
    icon: AlertCircle,
    tone: 'text-sev-critical-fg',
  },
]

export function LeaderboardStatusBoard({
  teams,
  activeStatus,
  onStatusChange,
}: LeaderboardStatusBoardProps) {
  return (
    <section aria-label="Состояние проверок" className="border-y border-line py-3">
      <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-5">
        {items.map(({ status, icon: Icon, tone }) => {
          const count = teams.filter((team) => displayStatus(team) === status).length
          const active = activeStatus === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              aria-label={`${statusLabel(status)}: ${count}`}
              className={`flex min-h-[56px] items-center gap-2 border-b-2 px-3 text-left transition-colors first:pl-0 last:pr-0 hover:bg-muted-surface sm:px-4 ${active ? 'border-brand bg-muted-surface font-medium' : 'border-transparent'}`}
              onClick={() => onStatusChange(active ? 'all' : status)}
            >
              <Icon
                aria-hidden="true"
                size={16}
                className={`${tone} ${status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
              <span>
                <span className="block text-count leading-none">{count}</span>
                <span className="mt-1 block text-[12.5px] text-fg-muted">
                  {statusLabel(status)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
