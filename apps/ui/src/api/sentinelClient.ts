import type {
  Board,
  BoardDetail,
  BoardSummary,
  CanvasLayout,
  Deployment,
  Project,
  WorkflowStep,
} from '@sentinel/shared-types'

const API_BASE = localStorage.getItem('sentinel_api_url')?.trim() || import.meta.env.VITE_API_URL || ''

function getApiBase(): string {
  const stored = localStorage.getItem('sentinel_api_url')?.trim()
  return stored && stored.length > 0 ? stored : API_BASE
}

function getApiKey(): string | null {
  if (import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY
  }
  return localStorage.getItem('sentinel_api_key')
}

function authHeadersJson(): HeadersInit {
  const key = getApiKey()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (key) {
    headers['x-api-key'] = key
  }
  return headers
}

function authHeaders(): HeadersInit {
  const key = getApiKey()
  const headers: HeadersInit = {}
  if (key) {
    headers['x-api-key'] = key
  }
  return headers
}

export async function fetchProject(id: string): Promise<Project> {
  const res = await fetch(`${getApiBase()}/api/projects/${id}`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`project: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${getApiBase()}/api/projects`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`projects: ${res.status}`)
  }
  return res.json() as Promise<Project[]>
}

export async function fetchBoards(): Promise<BoardSummary[]> {
  const res = await fetch(`${getApiBase()}/api/boards`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`boards: ${res.status}`)
  }
  return res.json() as Promise<BoardSummary[]>
}

export async function fetchBoard(id: string): Promise<BoardDetail> {
  const res = await fetch(`${getApiBase()}/api/boards/${id}`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`board: ${res.status}`)
  }
  return res.json() as Promise<BoardDetail>
}

export async function createBoard(body: { name: string }): Promise<Board> {
  const res = await fetch(`${API_BASE}/api/boards`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(err.message ?? err.error ?? `createBoard: ${res.status}`)
  }
  return res.json() as Promise<Board>
}

export async function importBoardProject(
  boardId: string,
  body: { githubUrl: string; branch?: string; name?: string },
): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/projects/import`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(err.message ?? err.error ?? `importBoardProject: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function removeBoardProject(boardId: string, projectId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/projects/${projectId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`removeBoardProject: ${res.status}`)
  }
}

export async function createProject(body: {
  githubUrl: string
  branch?: string
  name?: string
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
    throw new Error(err.message ?? err.error ?? `createProject: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`delete: ${res.status}`)
  }
}

export async function deployProject(id: string, options?: { pull?: boolean }): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${id}/deploy`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify({ pull: options?.pull ?? false }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `deploy: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function rollbackProject(
  projectId: string,
  deploymentId: string,
): Promise<Project> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/rollback`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify({ deploymentId }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `rollback: ${res.status}`)
  }
  return res.json() as Promise<Project>
}

export async function fetchDeployments(projectId: string): Promise<Deployment[]> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/deployments`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`deployments: ${res.status}`)
  }
  return res.json() as Promise<Deployment[]>
}

export async function fetchProjectStatus(projectId: string): Promise<{
  project: Project
  compose: unknown[]
}> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/status`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`status: ${res.status}`)
  }
  return res.json() as Promise<{ project: Project; compose: unknown[] }>
}

export async function fetchCanvas(projectId: string): Promise<CanvasLayout> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/canvas`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`canvas: ${res.status}`)
  }
  return res.json() as Promise<CanvasLayout>
}

export async function fetchBoardCanvas(boardId: string): Promise<CanvasLayout> {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/canvas`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`boardCanvas: ${res.status}`)
  }
  return res.json() as Promise<CanvasLayout>
}

export async function saveBoardCanvas(boardId: string, layout: CanvasLayout): Promise<void> {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/canvas`, {
    method: 'PUT',
    headers: authHeadersJson(),
    body: JSON.stringify(layout),
  })
  if (!res.ok) {
    throw new Error(`saveBoardCanvas: ${res.status}`)
  }
}

export async function saveCanvas(projectId: string, layout: CanvasLayout): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/canvas`, {
    method: 'PUT',
    headers: authHeadersJson(),
    body: JSON.stringify(layout),
  })
  if (!res.ok) {
    throw new Error(`saveCanvas: ${res.status}`)
  }
}

export async function fetchEnv(projectId: string): Promise<{ content: string }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/env`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`env: ${res.status}`)
  }
  return res.json() as Promise<{ content: string }>
}

export async function saveEnv(projectId: string, content: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/env`, {
    method: 'PUT',
    headers: authHeadersJson(),
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(`saveEnv: ${res.status}`)
  }
}

export async function fetchEnvDiff(projectId: string): Promise<{ env: string; example: string }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/env/diff`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`env-diff: ${res.status}`)
  }
  return res.json() as Promise<{ env: string; example: string }>
}

export async function runScript(
  projectId: string,
  path: string,
  args: string[] = [],
): Promise<{ ok: boolean; code: number; stdout: string; stderr: string }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/scripts/run`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify({ path, args }),
  })
  if (!res.ok) {
    throw new Error(`script: ${res.status}`)
  }
  return res.json() as Promise<{
    ok: boolean
    code: number
    stdout: string
    stderr: string
  }>
}

export async function dockerAction(
  projectId: string,
  action: 'start' | 'stop' | 'restart' | 'rebuild',
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/docker/${action}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `docker ${action}: ${res.status}`)
  }
}

export async function fetchSystemStats(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/system/stats`, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`stats: ${res.status}`)
  }
  return res.json()
}

export async function fetchSystemMetrics(): Promise<{
  cpu: { percent: number; cores: number }
  ram: { used_gb: number; total_gb: number; percent: number }
  disk: { used_gb: number; total_gb: number; percent: number }
  uptime: { seconds: number; human: string }
}> {
  const res = await fetch(`${API_BASE}/api/system/metrics`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`system metrics: ${res.status}`)
  return res.json()
}

export async function fetchSystemServices(): Promise<{
  services: Array<{ name: string; status: string; level: 'ok' | 'warn' | 'err'; note?: string }>
}> {
  const res = await fetch(`${API_BASE}/api/system/services`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`system services: ${res.status}`)
  return res.json()
}

export async function fetchSystemNetwork(): Promise<{
  public_ip: string
  dns_latency_ms: number
  active_connections: number
  open_ports: number[]
  rx_today_gb: number
  tx_today_gb: number
}> {
  const res = await fetch(`${API_BASE}/api/system/network`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`system network: ${res.status}`)
  return res.json()
}

export async function fetchSystemCpuHistory(): Promise<{ labels: string[]; values: number[] }> {
  const res = await fetch(`${API_BASE}/api/system/cpu-history`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`cpu history: ${res.status}`)
  return res.json()
}

export async function fetchSystemDiskDirs(): Promise<{
  dirs: Array<{ path: string; size_gb: number; percent: number }>
}> {
  const res = await fetch(`${API_BASE}/api/system/disk-dirs`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`disk dirs: ${res.status}`)
  return res.json()
}

export async function fetchMaintenanceRuns(): Promise<{
  runs: Array<{
    id: string
    started_at: string
    duration_seconds: number
    tasks_total: number
    tasks_ok: number
    status: 'ok' | 'warn' | 'err'
    backup_file: string
  }>
}> {
  const res = await fetch(`${API_BASE}/api/maintenance/runs`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`maintenance runs: ${res.status}`)
  return res.json()
}

export async function runMaintenanceNow(): Promise<{
  run_id: string
  message: string
  started_at: string
}> {
  const res = await fetch(`${API_BASE}/api/maintenance/run`, {
    method: 'POST',
    headers: authHeadersJson(),
  })
  if (!res.ok) throw new Error(`maintenance run: ${res.status}`)
  return res.json()
}

export async function fetchSystemLogs(
  level: 'all' | 'err' | 'warn' | 'ok' | 'info' = 'all',
): Promise<{ logs: Array<{ time: string; level: 'ok' | 'warn' | 'err' | 'info'; message: string }> }> {
  const qs = new URLSearchParams({ level })
  const res = await fetch(`${API_BASE}/api/logs?${qs.toString()}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`logs: ${res.status}`)
  return res.json()
}

export async function fetchSecurityStatus(): Promise<{
  security_updates_pending: number
  fail2ban_blocked_ips: number
  sudo_users_count: number
  unexpected_suid_files: string[]
  ufw_active: boolean
  disks: Array<{
    device: string
    capacity: string
    type: string
    smart_status: string
    wear_percent: number | null
    temperature_c: number | null
  }>
}> {
  const res = await fetch(`${API_BASE}/api/security/status`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`security status: ${res.status}`)
  return res.json()
}

export async function fetchSshAttempts(): Promise<{ labels: string[]; values: number[] }> {
  const res = await fetch(`${API_BASE}/api/security/ssh-attempts`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`ssh attempts: ${res.status}`)
  return res.json()
}

export async function fetchGithubRepos(): Promise<
  Array<{ name: string; fullName: string; cloneUrl: string; defaultBranch: string }>
> {
  const res = await fetch(`${API_BASE}/api/github/repos`, { headers: authHeaders() })
  if (!res.ok) {
    return []
  }
  const data: unknown = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchGithubBranches(url: string): Promise<{
  defaultBranch: string
  branches: string[]
}> {
  const qs = new URLSearchParams({ url })
  const res = await fetch(`${API_BASE}/api/github/branches?${qs.toString()}`, { headers: authHeaders() })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(err.message ?? err.error ?? `github branches: ${res.status}`)
  }
  return res.json() as Promise<{ defaultBranch: string; branches: string[] }>
}

export async function executeWidget(body: {
  type: 'action_button' | 'rest_explorer' | 'docker_control' | 'script_runner'
  projectId?: string
  config: Record<string, unknown>
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/widgets/execute`, {
    method: 'POST',
    headers: authHeadersJson(),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `widget: ${res.status}`)
  }
  return res.json()
}

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

export function getScriptStreamUrl(projectId: string, scriptPath: string): string | null {
  const key = getApiKey()
  if (!key) {
    return null
  }
  const qs = new URLSearchParams({ apiKey: key, path: scriptPath })
  const path = `/api/projects/${projectId}/scripts/run/stream?${qs.toString()}`
  if (API_BASE) {
    return `${API_BASE.replace(/\/$/, '')}${path}`
  }
  return path
}

/** Consume SSE from POST workflow (text/event-stream). */
export async function runWorkflow(
  projectId: string,
  steps: WorkflowStep[],
  onEvent: (data: unknown) => void,
): Promise<void> {
  const key = getApiKey()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (key) {
    headers.set('x-api-key', key)
  }
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/workflows/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ steps }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`workflow: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() ?? ''
    for (const block of parts) {
      const line = block.split('\n').find((l) => l.startsWith('data:'))
      if (!line) {
        continue
      }
      const json = line.slice(5).trim()
      try {
        onEvent(JSON.parse(json) as unknown)
      } catch {
        onEvent(json)
      }
    }
  }
}
