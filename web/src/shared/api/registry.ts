export interface RegistryTeam {
  id: string
  name: string
  repo: string
  branch: string
  active: boolean
  paths?: Record<string, string>
}

const TOKEN_KEY = 'team-registry-api-token'

export class RegistryApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function readRegistryToken() {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function saveRegistryToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearRegistryToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

export async function checkRegistryApi() {
  try {
    const response = await fetch('/healthz', { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

export async function getRegistryTeams(token: string): Promise<RegistryTeam[]> {
  return request<RegistryTeam[]>('/api/teams', token)
}

export async function createRegistryTeam(token: string, team: RegistryTeam) {
  return request<RegistryTeam>('/api/teams', token, 'POST', team)
}

export async function updateRegistryTeam(token: string, team: RegistryTeam) {
  return request<RegistryTeam>(`/api/teams/${encodeURIComponent(team.id)}`, token, 'PUT', team)
}

export async function deleteRegistryTeam(token: string, id: string) {
  await request<void>(`/api/teams/${encodeURIComponent(id)}`, token, 'DELETE')
}

async function request<T>(
  url: string,
  token: string,
  method = 'GET',
  body?: RegistryTeam,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
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
