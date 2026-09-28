import type { EvaluationProgress } from './generated/evaluation-progress'

const REQUEST_TIMEOUT_MS = 15_000

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
    const response = await fetchWithTimeout('/api/teams', { cache: 'no-store' })
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

export async function updateRegistryTeam(team: RegistryTeam) {
  return request<RegistryTeam>(`/api/teams/${encodeURIComponent(team.id)}`, 'PUT', team)
}

export async function deleteRegistryTeam(teamId: string) {
  return request<void>(`/api/teams/${encodeURIComponent(teamId)}`, 'DELETE')
}

export async function retryRegistryEvaluation(teamId: string) {
  return request<{ team_id: string; status: RegistryEvaluationStatus }>(
    `/api/teams/${encodeURIComponent(teamId)}/retry`,
    'POST',
  )
}

export type RegistryEvaluationStatus = EvaluationProgress['status']
export type RegistryEvaluationStage = EvaluationProgress['stage']
export type RegistryEvaluationProgress = EvaluationProgress & { legacy?: boolean }

export async function getRegistryEvaluationProgress(
  teamId: string,
): Promise<RegistryEvaluationProgress> {
  const response = await fetchWithTimeout(
    `/api/evaluation/progress/${encodeURIComponent(teamId)}`,
    {
      cache: 'no-store',
    },
  )
  if (response.status === 404) {
    const status = await getRegistryEvaluationStatus(teamId)
    return {
      status: status ?? 'running',
      stage: status === 'done' ? 'done' : 'waiting',
      areas: [],
      events: [],
      legacy: true,
    }
  }
  if (!response.ok)
    throw new RegistryApiError('Не удалось получить этап обработки', response.status)
  const progress = (await response.json()) as Partial<RegistryEvaluationProgress>
  return {
    status: progress.status ?? 'no_data',
    stage: progress.stage ?? 'waiting',
    started_at: progress.started_at,
    areas: progress.areas ?? [],
    events: progress.events ?? [],
    legacy: progress.legacy,
  }
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
  const response = await fetchWithTimeout('/api/bundle/index', { cache: 'no-store' })
  if (!response.ok)
    throw new RegistryApiError('Не удалось получить статус обработки', response.status)
  const index = (await response.json()) as {
    teams?: { team_id: string; status: RegistryEvaluationStatus }[]
  }
  return Object.fromEntries(index.teams?.map((team) => [team.team_id, team.status]) ?? [])
}

async function request<T>(url: string, method = 'GET', body?: RegistryTeam): Promise<T> {
  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      method,
      cache: 'no-store',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new RegistryApiError(
        'Сервер отвечает слишком долго. Проверьте соединение и повторите попытку.',
        0,
      )
    }
    throw cause
  } finally {
    clearTimeout(timer)
  }
}
