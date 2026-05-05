const API_BASE = import.meta.env.VITE_API_URL ?? ''

function getApiKey(): string | null {
  if (import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY
  }
  return localStorage.getItem('sentinel_api_key')
}

export async function fetchProjects(): Promise<unknown[]> {
  const key = getApiKey()
  const headers: HeadersInit = {}
  if (key) {
    headers['x-api-key'] = key
  }
  const res = await fetch(`${API_BASE}/api/projects`, { headers })
  if (!res.ok) {
    throw new Error(`projects: ${res.status}`)
  }
  return res.json() as Promise<unknown[]>
}
