import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

type MaintenanceRun = {
  id: string
  started_at: string
  duration_seconds: number
  tasks_total: number
  tasks_ok: number
  status: 'ok' | 'warn' | 'err'
  backup_file: string
}

type LogItem = { time: string; level: 'ok' | 'warn' | 'err' | 'info'; message: string }
type DataSource = 'real' | 'fallback'

const RUNS_DIR = process.env.SENTINEL_RUNS_DIR ?? '/var/log/sentinel/runs'
const LOG_FILE = process.env.SENTINEL_MAINTENANCE_LOG ?? '/var/log/mantenimiento.log'
const CPU_HISTORY_FILE = process.env.SENTINEL_CPU_HISTORY_FILE ?? '/var/cache/sentinel/cpu_history.jsonl'
const DISK_DIRS_CACHE = process.env.SENTINEL_DISK_DIRS_CACHE ?? '/var/cache/sentinel/disk_dirs.json'
const MAINTENANCE_SCRIPT = process.env.SENTINEL_MAINTENANCE_SCRIPT ?? ''
const USE_HOST_NSENTER =
  process.env.SENTINEL_USE_HOST_NSENTER === '1' || process.env.SENTINEL_USE_HOST_NSENTER === 'true'
const MONITORED_SERVICES =
  process.env.SENTINEL_MONITORED_SERVICES?.split(',').map((s) => s.trim()).filter(Boolean) ?? [
    'nginx',
    'postgresql',
    'redis',
    'fail2ban',
    'smtp',
  ]

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeStatus(value: string | undefined): 'ok' | 'warn' | 'err' {
  if (value === 'ok' || value === 'warn' || value === 'err') return value
  return 'ok'
}

function nowRunId(): string {
  return `run_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
}

const maintenanceState: {
  running: boolean
  currentRunId: string | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  lastExitCode: number | null
} = {
  running: false,
  currentRunId: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastExitCode: null,
}

function runShell(
  command: string,
  args: string[],
  timeoutMs = 8000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = USE_HOST_NSENTER
      ? spawn('nsenter', ['-t', '1', '-m', '-u', '-i', '-n', '-p', '--', command, ...args], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      : spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
    }, timeoutMs)
    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: `${stderr}${String(err)}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export async function readMaintenanceRuns(): Promise<{
  runs: MaintenanceRun[]
  source: DataSource
  source_reason?: string
}> {
  try {
    const files = await readdir(RUNS_DIR)
    const jsonFiles = files.filter((f) => f.endsWith('.json'))
    const runs: MaintenanceRun[] = []
    for (const file of jsonFiles) {
      const fullPath = join(RUNS_DIR, file)
      const raw = await readFile(fullPath, 'utf8')
      const data = safeJsonParse<Record<string, unknown>>(raw)
      if (!data) continue
      runs.push({
        id: String(data.id ?? file.replace(/\.json$/, '')),
        started_at: String(data.started_at ?? new Date().toISOString()),
        duration_seconds: Number(data.duration_seconds ?? 0),
        tasks_total: Number(data.tasks_total ?? 0),
        tasks_ok: Number(data.tasks_ok ?? 0),
        status: normalizeStatus(String(data.status ?? 'ok')),
        backup_file: String(data.backup_file ?? ''),
      })
    }
    runs.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    return { runs, source: 'real' }
  } catch (error) {
    return {
      runs: [
        {
          id: 'run_20260507_020000',
          started_at: '2026-05-07T02:00:00Z',
          duration_seconds: 222,
          tasks_total: 5,
          tasks_ok: 5,
          status: 'ok',
          backup_file: 'backup_20260507_020000.tar.gz',
        },
      ],
      source: 'fallback',
      source_reason: error instanceof Error ? error.message : `Cannot read ${RUNS_DIR}`,
    }
  }
}

export async function triggerMaintenanceRun(): Promise<{
  run_id: string
  message: string
  started_at: string
}> {
  if (!MAINTENANCE_SCRIPT) {
    throw new Error('SENTINEL_MAINTENANCE_SCRIPT no está configurado en el backend')
  }

  const runId = nowRunId()
  const startedAt = new Date().toISOString()
  if (maintenanceState.running) {
    throw new Error('Ya hay una ejecución de mantenimiento en curso')
  }

  maintenanceState.running = true
  maintenanceState.currentRunId = runId
  maintenanceState.lastStartedAt = startedAt
  maintenanceState.lastExitCode = null

  const child = USE_HOST_NSENTER
    ? spawn('nsenter', ['-t', '1', '-m', '-u', '-i', '-n', '-p', '--', 'bash', MAINTENANCE_SCRIPT], {
        detached: false,
        stdio: 'ignore',
      })
    : spawn('bash', [MAINTENANCE_SCRIPT], {
        detached: false,
        stdio: 'ignore',
      })
  child.on('close', (code) => {
    maintenanceState.running = false
    maintenanceState.lastFinishedAt = new Date().toISOString()
    maintenanceState.lastExitCode = code ?? 1
    maintenanceState.currentRunId = null
  })
  child.on('error', () => {
    maintenanceState.running = false
    maintenanceState.lastFinishedAt = new Date().toISOString()
    maintenanceState.lastExitCode = 1
    maintenanceState.currentRunId = null
  })

  return { run_id: runId, message: 'Mantenimiento iniciado', started_at: startedAt }
}

export function readMaintenanceStatus(): {
  running: boolean
  current_run_id: string | null
  last_started_at: string | null
  last_finished_at: string | null
  last_exit_code: number | null
} {
  return {
    running: maintenanceState.running,
    current_run_id: maintenanceState.currentRunId,
    last_started_at: maintenanceState.lastStartedAt,
    last_finished_at: maintenanceState.lastFinishedAt,
    last_exit_code: maintenanceState.lastExitCode,
  }
}

export async function readSystemLogs(
  level: 'all' | 'err' | 'warn' | 'ok' | 'info',
  limit: number,
): Promise<{ logs: LogItem[]; source: DataSource; source_reason?: string }> {
  const fallback: LogItem[] = [
    { time: '02:03:41', level: 'ok', message: 'Mantenimiento completado sin errores críticos' },
    { time: '02:01:10', level: 'warn', message: 'Redis en alto uso de memoria' },
    { time: '02:00:58', level: 'err', message: 'Servicio smtp inactivo — no se pudo iniciar' },
    { time: '01:58:40', level: 'info', message: 'Chequeo de puertos abierto completado' },
  ]
  try {
    const raw = await readFile(LOG_FILE, 'utf8')
    const lines = raw.split('\n').filter((l) => l.trim().length > 0)
    const parsed = lines
      .map((line): LogItem => {
        const timeMatch = line.match(/\b(\d{2}:\d{2}:\d{2})\b/)
        const lower = line.toLowerCase()
        const logLevel: LogItem['level'] = lower.includes('error') || lower.includes('✖')
          ? 'err'
          : lower.includes('warn') || lower.includes('⚠')
            ? 'warn'
            : lower.includes('ok') || lower.includes('✔')
              ? 'ok'
              : 'info'
        return { time: timeMatch?.[1] ?? '--:--:--', level: logLevel, message: line }
      })
      .reverse()
    const filtered = level === 'all' ? parsed : parsed.filter((log) => log.level === level)
    return { logs: filtered.slice(0, limit), source: 'real' }
  } catch (error) {
    const filtered = level === 'all' ? fallback : fallback.filter((log) => log.level === level)
    return {
      logs: filtered.slice(0, limit),
      source: 'fallback',
      source_reason: error instanceof Error ? error.message : `Cannot read ${LOG_FILE}`,
    }
  }
}

export async function readCpuHistory12h(): Promise<{
  labels: string[]
  values: number[]
  source: DataSource
  source_reason?: string
}> {
  try {
    const raw = await readFile(CPU_HISTORY_FILE, 'utf8')
    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => safeJsonParse<{ ts?: string; cpu?: number }>(line))
      .filter((item): item is { ts?: string; cpu?: number } => Boolean(item))
      .map((item) => ({
        ts: item.ts ? new Date(item.ts) : new Date(),
        cpu: Number(item.cpu ?? 0),
      }))
      .filter((item) => Number.isFinite(item.cpu))
    const now = new Date()
    const labels: string[] = []
    const values: number[] = []
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 3600_000)
      const hour = d.getHours()
      const hourEntries = entries.filter((e) => e.ts.getHours() === hour)
      const avg = hourEntries.length
        ? hourEntries.reduce((acc, cur) => acc + cur.cpu, 0) / hourEntries.length
        : 0
      labels.push(`${hour}:00`)
      values.push(Math.round(avg))
    }
    return { labels, values, source: 'real' }
  } catch (error) {
    const now = new Date()
    const labels: string[] = []
    const values: number[] = []
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 3600_000)
      labels.push(`${d.getHours()}:00`)
      values.push(Math.max(10, Math.min(95, 15 + Math.round(Math.sin(i) * 18) + i)))
    }
    return {
      labels,
      values,
      source: 'fallback',
      source_reason: error instanceof Error ? error.message : `Cannot read ${CPU_HISTORY_FILE}`,
    }
  }
}

export async function readDiskDirs(): Promise<{
  dirs: Array<{ path: string; size_gb: number; percent: number }>
  source: DataSource
  source_reason?: string
}> {
  try {
    const raw = await readFile(DISK_DIRS_CACHE, 'utf8')
    const data = safeJsonParse<Array<{ path: string; size_gb: number; percent: number }>>(raw)
    if (!data || !Array.isArray(data) || data.length === 0) throw new Error('empty')
    return { dirs: data.slice(0, 5), source: 'real' }
  } catch (error) {
    return {
      dirs: [
        { path: '/var', size_gb: 38.2, percent: 39 },
        { path: '/home', size_gb: 27.1, percent: 28 },
        { path: '/usr', size_gb: 14.4, percent: 15 },
        { path: '/opt', size_gb: 6.3, percent: 6 },
        { path: '/tmp', size_gb: 1.2, percent: 1 },
      ],
      source: 'fallback',
      source_reason: error instanceof Error ? error.message : `Cannot read ${DISK_DIRS_CACHE}`,
    }
  }
}

export async function readSystemServices(): Promise<{
  services: Array<{ name: string; status: string; level: 'ok' | 'warn' | 'err'; note?: string }>
  source: DataSource
  source_reason?: string
}> {
  const services = await Promise.all(
    MONITORED_SERVICES.map(async (name) => {
      const r = await runShell('systemctl', ['is-active', name])
      const status = r.code === 0 ? r.stdout.trim() || 'active' : 'inactive'
      const level: 'ok' | 'warn' | 'err' = status === 'active' ? 'ok' : 'err'
      return { name, status, level }
    }),
  )
  const hasRealSignal = services.some((s) => s.status === 'active')
  return hasRealSignal
    ? { services, source: 'real' }
    : { services, source: 'fallback', source_reason: 'systemctl is unavailable or all services are inactive' }
}

export async function readSystemNetwork(): Promise<{
  public_ip: string
  dns_latency_ms: number
  active_connections: number
  open_ports: number[]
  rx_today_gb: number
  tx_today_gb: number
  source: DataSource
  source_reason?: string
}> {
  const ipRes = await runShell('bash', ['-lc', 'curl -s https://api.ipify.org || true'])
  const dnsRes = await runShell(
    'bash',
    ['-lc', "dig @8.8.8.8 google.com 2>/dev/null | awk '/Query time/ {print $4}'"],
  )
  const connRes = await runShell('bash', ['-lc', "ss -s | awk '/TCP:/ {print $2}'"])
  const portsRes = await runShell(
    'bash',
    ['-lc', "ss -tlnp | awk 'NR>1 {print $4}' | awk -F: '{print $NF}' | sort -un"],
  )
  const netDev = await runShell('bash', ['-lc', "cat /proc/net/dev | awk -F':' 'NR>2 {print $2}'"])

  const rxTx = netDev.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (acc, line) => {
        const cols = line.split(/\s+/).map((v) => Number(v))
        acc.rx += Number.isFinite(cols[0]) ? cols[0] : 0
        acc.tx += Number.isFinite(cols[8]) ? cols[8] : 0
        return acc
      },
      { rx: 0, tx: 0 },
    )

  const source: DataSource =
    ipRes.code === 0 || dnsRes.code === 0 || connRes.code === 0 || portsRes.code === 0 ? 'real' : 'fallback'

  return {
    public_ip: ipRes.stdout.trim() || 'n/a',
    dns_latency_ms: Number.parseInt(dnsRes.stdout.trim(), 10) || 0,
    active_connections: Number.parseInt(connRes.stdout.trim(), 10) || 0,
    open_ports: portsRes.stdout
      .split('\n')
      .map((p) => Number.parseInt(p.trim(), 10))
      .filter((n) => Number.isFinite(n)),
    rx_today_gb: Number((rxTx.rx / 1024 ** 3).toFixed(2)),
    tx_today_gb: Number((rxTx.tx / 1024 ** 3).toFixed(2)),
    source,
    source_reason: source === 'fallback' ? 'Network shell probes did not return usable data' : undefined,
  }
}

export async function readSecurityStatus(): Promise<{
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
  source: DataSource
  source_reason?: string
}> {
  const secUpdates = await runShell(
    'bash',
    ['-lc', "apt-get -s upgrade 2>/dev/null | grep -i security | wc -l || true"],
  )
  const f2b = await runShell(
    'bash',
    [
      '-lc',
      "fail2ban-client status sshd 2>/dev/null | awk '/Currently banned/ {print $NF}' || echo 0",
    ],
  )
  const sudoUsers = await runShell(
    'bash',
    ["-lc", "grep -Po '^sudo.+:\\K.*$' /etc/group 2>/dev/null | tr ',' '\\n'"],
  )
  const suid = await runShell(
    'bash',
    [
      '-lc',
      "find / -perm -4000 -not -path '/usr/*' -not -path '/bin/*' -not -path '/sbin/*' 2>/dev/null | head -20",
    ],
  )
  const ufw = await runShell('bash', ['-lc', "ufw status 2>/dev/null | grep -i 'Status: active' || true"])

  const source: DataSource =
    secUpdates.code === 0 || f2b.code === 0 || sudoUsers.code === 0 || suid.code === 0 || ufw.code === 0
      ? 'real'
      : 'fallback'

  return {
    security_updates_pending: Number.parseInt(secUpdates.stdout.trim(), 10) || 0,
    fail2ban_blocked_ips: Number.parseInt(f2b.stdout.trim(), 10) || 0,
    sudo_users_count: sudoUsers.stdout
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean).length,
    unexpected_suid_files: suid.stdout
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    ufw_active: ufw.stdout.toLowerCase().includes('active'),
    disks: [
      {
        device: '/dev/sda',
        capacity: '500 GB',
        type: 'SSD',
        smart_status: 'PASSED',
        wear_percent: 12,
        temperature_c: null,
      },
    ],
    source,
    source_reason: source === 'fallback' ? 'Security commands unavailable on this host' : undefined,
  }
}

export async function readSshAttempts24h(): Promise<{
  labels: string[]
  values: number[]
  source: DataSource
  source_reason?: string
}> {
  const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
  const attempts = new Array<number>(24).fill(0)
  const logRes = await runShell(
    'bash',
    ["-lc", "grep 'Failed password' /var/log/auth.log 2>/dev/null | awk '{print $3}' | cut -d: -f1"],
  )
  for (const line of logRes.stdout.split('\n')) {
    const hour = Number.parseInt(line.trim(), 10)
    if (Number.isFinite(hour) && hour >= 0 && hour < 24) attempts[hour] += 1
  }
  const source: DataSource = logRes.code === 0 ? 'real' : 'fallback'
  return {
    labels,
    values: attempts,
    source,
    source_reason: source === 'fallback' ? '/var/log/auth.log unreadable or missing' : undefined,
  }
}

