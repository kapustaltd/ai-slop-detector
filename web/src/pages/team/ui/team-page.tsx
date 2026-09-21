import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { loadTeam } from '@/shared/api'

/**
 * Заглушка страницы команды. Графики, drill-down и находки — предмет спеки 006.
 * Загрузка здесь нужна каркасу: она проверяет, что файл команды приезжает отдельным чанком.
 */
export function TeamPage() {
  const { teamId } = useParams()
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    loadTeam(teamId)
      .then(() => !cancelled && setState('ready'))
      .catch(() => !cancelled && setState('missing'))
    return () => {
      cancelled = true
    }
  }, [teamId])

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Команда {teamId}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {state === 'missing'
          ? 'В бандле нет данных этой команды'
          : 'Страница наполняется в спеке 006'}
      </p>
    </main>
  )
}
