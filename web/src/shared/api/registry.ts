export interface RegistryTeam {
  id: string
  name: string
  repo: string
  branch: string
  active: boolean
  paths?: Record<string, string>
}

export class RegistryApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function checkRegistryApi() {
  try {
    const response = await fetch('/api/teams', { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

export async function getRegistryTeams(): Promise<RegistryTeam[]> {
  return request<RegistryTeam[]>('/api/teams')
}

export async function createRegistryTeam(team: RegistryTeam) {
  return request<RegistryTeam>('/api/teams', 'POST', team)
}

export async function updateRegistryTeam(team: RegistryTeam, token: string) {
  return request<RegistryTeam>(`/api/teams/${encodeURIComponent(team.id)}`, 'PUT', team, token)
}

export async function deleteRegistryTeam(teamId: string) {
  return request<void>(`/api/teams/${encodeURIComponent(teamId)}`, 'DELETE')
}

export type RegistryEvaluationStatus = 'done' | 'failed' | 'no_data' | 'running'
export type RegistryEvaluationStage =
  'waiting' | 'dispatching' | 'runner_queued' | 'analyzing' | 'publishing' | 'done'

export interface RegistryEvaluationProgress {
  status: RegistryEvaluationStatus
  stage: RegistryEvaluationStage
  started_at?: string
  legacy?: boolean
}

export async function getRegistryEvaluationProgress(
  teamId: string,
): Promise<RegistryEvaluationProgress> {
  const response = await fetch(`/api/evaluation/progress/${encodeURIComponent(teamId)}`, {
    cache: 'no-store',
  })
  if (response.status === 404) {
    const status = await getRegistryEvaluationStatus(teamId)
    return {
      status: status ?? 'running',
      stage: status === 'done' ? 'done' : 'waiting',
      legacy: true,
    }
  }
  if (!response.ok)
    throw new RegistryApiError('Не удалось получить этап обработки', response.status)
  return (await response.json()) as RegistryEvaluationProgress
}

/** Read only the live index: a build-time bundle cannot report current progress. */
export async function getRegistryEvaluationStatus(
  teamId: string,
): Promise<RegistryEvaluationStatus | null> {
  const statuses = await getRegistryEvaluationStatuses()
  return statuses[teamId] ?? null
}

export async function getRegistryEvaluationStatuses(): Promise<
  Record<string, RegistryEvaluationStatus>
> {
  const response = await fetch('/api/bundle/index', { cache: 'no-store' })
  if (!response.ok)
    throw new RegistryApiError('Не удалось получить статус обработки', response.status)
  const index = (await response.json()) as {
    teams?: { team_id: string; status: RegistryEvaluationStatus }[]
  }
  return Object.fromEntries(index.teams?.map((team) => [team.team_id, team.status]) ?? [])
}

async function request<T>(
  url: string,
  method = 'GET',
  body?: RegistryTeam,
  token?: string,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new RegistryApiError('Не удалось подключиться к API команд', 0)
  }

  if (response.status === 204) return undefined as T
  const result = (await response.json().catch(() => null)) as { error?: string } | T | null
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result ? result.error : ''
    throw new RegistryApiError(message || 'Не удалось выполнить запрос', response.status)
  }
  return result as T
}
