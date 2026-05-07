import type { FastifyInstance } from 'fastify'
import { getSystemStats, listDockerContainers } from '../services/SystemService'

type MaintenanceRun = {
  id: string
  started_at: string
  duration_seconds: number
  tasks_total: number
  tasks_ok: number
  status: 'ok' | 'warn' | 'err'
  backup_file: string
}

const maintenanceRuns: MaintenanceRun[] = [
  {
    id: 'run_20260507_020000',
    started_at: '2026-05-07T02:00:00Z',
    duration_seconds: 222,
    tasks_total: 5,
    tasks_ok: 5,
    status: 'ok',
    backup_file: 'backup_20260507_020000.tar.gz',
  },
  {
    id: 'run_20260506_020000',
    started_at: '2026-05-06T02:00:00Z',
    duration_seconds: 238,
    tasks_total: 5,
    tasks_ok: 4,
    status: 'warn',
    backup_file: 'backup_20260506_020000.tar.gz',
  },
]

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/system/stats', async () => getSystemStats())
  app.get('/system/docker/containers', async () => listDockerContainers())

  app.get('/system/metrics', async () => {
    const stats = await getSystemStats()
    const ramPercent =
      stats.mem.total > 0 ? clampPercent((stats.mem.used / stats.mem.total) * 100) : 0
    const diskPercent =
      stats.disk && stats.disk.size > 0 ? clampPercent((stats.disk.used / stats.disk.size) * 100) : 0
    const uptimeSec = Math.max(0, Math.floor(stats.uptime))
    const days = Math.floor(uptimeSec / 86400)
    const hours = Math.floor((uptimeSec % 86400) / 3600)
    return {
      cpu: { percent: clampPercent(stats.cpu.load), cores: 4 },
      ram: {
        used_gb: Number((stats.mem.used / 1024 ** 3).toFixed(1)),
        total_gb: Number((stats.mem.total / 1024 ** 3).toFixed(1)),
        percent: Number(ramPercent.toFixed(1)),
      },
      disk: {
        used_gb: Number(((stats.disk?.used ?? 0) / 1024 ** 3).toFixed(1)),
        total_gb: Number(((stats.disk?.size ?? 0) / 1024 ** 3).toFixed(1)),
        percent: Number(diskPercent.toFixed(1)),
      },
      uptime: {
        seconds: uptimeSec,
        human: `${days}d ${hours}h`,
      },
    }
  })

  app.get('/system/services', async () => {
    return {
      services: [
        { name: 'nginx', status: 'active', level: 'ok' },
        { name: 'postgresql', status: 'active', level: 'ok' },
        { name: 'redis', status: 'active', level: 'warn', note: 'alto uso de memoria' },
        { name: 'fail2ban', status: 'active', level: 'ok' },
        { name: 'smtp', status: 'inactive', level: 'err' },
      ],
    }
  })

  app.get('/system/network', async () => {
    return {
      public_ip: '185.234.XX.XX',
      dns_latency_ms: 12,
      active_connections: 47,
      open_ports: [22, 80, 443, 5432],
      rx_today_gb: 2.3,
      tx_today_gb: 0.9,
    }
  })

  app.get('/system/cpu-history', async () => {
    const now = new Date()
    const labels: string[] = []
    const values: number[] = []
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 3600_000)
      labels.push(`${d.getHours()}:00`)
      values.push(Math.max(10, Math.min(95, 15 + Math.round(Math.sin(i) * 18) + i)))
    }
    return { labels, values }
  })

  app.get('/system/disk-dirs', async () => {
    return {
      dirs: [
        { path: '/var', size_gb: 38.2, percent: 39 },
        { path: '/home', size_gb: 27.1, percent: 28 },
        { path: '/usr', size_gb: 14.4, percent: 15 },
        { path: '/opt', size_gb: 6.3, percent: 6 },
        { path: '/tmp', size_gb: 1.2, percent: 1 },
      ],
    }
  })

  app.get('/maintenance/runs', async () => ({ runs: maintenanceRuns }))

  app.post('/maintenance/run', async (_request, reply) => {
    const runId = `run_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
    maintenanceRuns.unshift({
      id: runId,
      started_at: new Date().toISOString(),
      duration_seconds: 120,
      tasks_total: 5,
      tasks_ok: 5,
      status: 'ok',
      backup_file: `backup_${runId}.tar.gz`,
    })
    await reply.code(202).send({
      run_id: runId,
      message: 'Mantenimiento iniciado',
      started_at: new Date().toISOString(),
    })
  })

  app.get<{ Querystring: { level?: 'all' | 'err' | 'warn' | 'ok' | 'info'; limit?: string } }>(
    '/logs',
    async (request) => {
      const allLogs = [
        { time: '02:03:41', level: 'ok', message: 'Mantenimiento completado sin errores críticos' },
        { time: '02:01:10', level: 'warn', message: 'Redis en alto uso de memoria' },
        { time: '02:00:58', level: 'err', message: 'Servicio smtp inactivo — no se pudo iniciar' },
        { time: '01:58:40', level: 'info', message: 'Chequeo de puertos abierto completado' },
      ] as const
      const level = request.query.level ?? 'all'
      const limit = Math.max(1, Math.min(500, Number.parseInt(request.query.limit ?? '100', 10) || 100))
      const filtered =
        level === 'all' ? allLogs : allLogs.filter((log) => log.level === level)
      return { logs: filtered.slice(0, limit) }
    },
  )

  app.get('/security/status', async () => {
    return {
      security_updates_pending: 0,
      fail2ban_blocked_ips: 14,
      sudo_users_count: 2,
      unexpected_suid_files: [],
      ufw_active: true,
      disks: [
        {
          device: '/dev/sda',
          capacity: '500 GB',
          type: 'SSD',
          smart_status: 'PASSED',
          wear_percent: 12,
          temperature_c: null,
        },
        {
          device: '/dev/sdb',
          capacity: '2 TB',
          type: 'HDD',
          smart_status: 'PASSED',
          wear_percent: null,
          temperature_c: 42,
        },
      ],
    }
  })

  app.get('/security/ssh-attempts', async () => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`)
    const values = labels.map((_, idx) => Math.max(0, Math.round((Math.sin(idx / 2) + 1) * 5)))
    return { labels, values }
  })
}
