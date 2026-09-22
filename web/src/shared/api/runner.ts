export type RunArea = 'backend' | 'frontend' | 'both'
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type RunRequest = {
  repository_url: string
  repository_id: string
  branch: string
  area: RunArea
}

export type RunSummary = {
  run_id: string
  teams_total: number
  teams_done: number
  teams_failed: number
  areas_done: number
  areas_failed: number
  duration_ms: number
  cost_usd: number
}

export type RunJob = RunRequest & {
  id: string
  status: RunStatus
  progress: Record<string, RunStatus>
  created_at: string
  started_at?: string
  finished_at?: string
  logs?: string[]
  summary?: RunSummary
  error?: string
}

type ApiErrorPayload = {
  error?: { code?: string; message?: string; details?: Array<{ field?: string; message?: string }> }
}

const apiBase = (import.meta.env.VITE_RUNNER_API_BASE as string | undefined) ?? '/api/v1'

function headers(token: string) {
  const result: Record<string, string> = { Accept: 'application/json' }
  if (token.trim()) result.Authorization = `Bearer ${token.trim()}`
  return result
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | ApiErrorPayload | null
  if (response.ok) return payload as T
  const error = payload as ApiErrorPayload | null
  const details = error?.error?.details
    ?.map((item) =>
      item.field ? `${item.field}: ${item.message ?? 'неверное значение'}` : item.message,
    )
    .filter(Boolean)
    .join('; ')
  throw new Error(
    error?.error?.message
      ? `${error.error.message}${details ? ` — ${details}` : ''}`
      : `Ошибка API (${response.status})`,
  )
}

export async function createRun(input: RunRequest, token: string): Promise<RunJob> {
  const response = await fetch(`${apiBase}/runs`, {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await readResponse<{ data: RunJob }>(response)
  return payload.data
}

export async function getRun(id: string, token: string): Promise<RunJob> {
  const response = await fetch(`${apiBase}/runs/${encodeURIComponent(id)}`, {
    headers: headers(token),
  })
  const payload = await readResponse<{ data: RunJob }>(response)
  return payload.data
}

export function isTerminal(status: RunStatus) {
  return status === 'succeeded' || status === 'failed'
}
