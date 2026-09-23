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

async function request<T>(url: string, method = 'GET', body?: RegistryTeam): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
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
