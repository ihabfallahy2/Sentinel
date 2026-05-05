import type { Project } from '@sentinel/shared-types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function getApiKey(): string | null {
  if (import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY
  }
  return localStorage.getItem('sentinel_api_key')
}

function authHeaders(): HeadersInit {
  const key = getApiKey()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (key) {
    headers['x-api-key'] = key
  }
  return headers
}

export async function fetchProjects(): Promise<Project[]> {
  const key = getApiKey()
  const headers: HeadersInit = {}
  if (key) {
    headers['x-api-key'] = key
  }
  const res = await fetch(`${API_BASE}/api/projects`, { headers })
  if (!res.ok) {
    throw new Error(`projects: ${res.status}`)
  }
  return res.json() as Promise<Project[]>
}

export async function createProject(body: {
  githubUrl: string
  branch?: string
  name?: string
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new Error(err.message ?? err.error ?? `createProject: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function deployProject(id: string): Promise<Project> {
  const key = getApiKey()
  const headers: HeadersInit = {}
  if (key) {
    headers['x-api-key'] = key
  }
  const res = await fetch(`${API_BASE}/api/projects/${id}/deploy`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `deploy: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

/** URL para EventSource (sin cabecera custom): incluye apiKey en query. */
export function getLogStreamUrl(projectId: string): string | null {
  const key = getApiKey()
  if (!key) {
    return null
  }
  const qs = new URLSearchParams({ apiKey: key })
  const path = `/api/projects/${projectId}/logs/stream?${qs.toString()}`
  if (API_BASE) {
    return `${API_BASE.replace(/\/$/, '')}${path}`
  }
  return path
}
