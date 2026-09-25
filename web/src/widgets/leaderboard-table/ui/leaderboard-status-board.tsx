import { AlertCircle, CheckCircle2, Clock3, LoaderCircle } from 'lucide-react'

import type { EvaluationStatus, LeaderboardTeam } from '@/shared/api'

interface LeaderboardStatusBoardProps {
  teams: LeaderboardTeam[]
  activeStatus: EvaluationStatus | 'all'
  onStatusChange: (status: EvaluationStatus | 'all') => void
}

const items: {
  status: EvaluationStatus
  label: string
  activeLabel: string
  icon: typeof LoaderCircle
  tone: string
}[] = [
  {
    status: 'running',
    label: 'проверяются',
    activeLabel: 'Проверяются',
    icon: LoaderCircle,
    tone: 'text-brand',
  },
  {
    status: 'no_data',
    label: 'в очереди',
    activeLabel: 'В очереди',
    icon: Clock3,
    tone: 'text-fg-muted',
  },
  {
    status: 'done',
    label: 'завершено',
    activeLabel: 'Завершено',
    icon: CheckCircle2,
    tone: 'text-sev-strength-fg',
  },
  {
    status: 'failed',
    label: 'с ошибкой',
    activeLabel: 'С ошибкой',
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
      <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
        {items.map(({ status, label, activeLabel, icon: Icon, tone }) => {
          const count = teams.filter((team) => team.status === status).length
          const active = activeStatus === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              className={`flex min-h-[56px] items-center gap-2 px-3 text-left transition-colors first:pl-0 last:pr-0 hover:bg-muted-surface sm:px-4 ${active ? 'bg-muted-surface' : ''}`}
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
                  {active ? activeLabel : label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
