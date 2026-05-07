import type { FastifyInstance } from 'fastify'
import { getSystemStats, listDockerContainers } from '../services/SystemService'
import {
  readCpuHistory12h,
  readDiskDirs,
  readMaintenanceRuns,
  readMaintenanceStatus,
  readSecurityStatus,
  readSshAttempts24h,
  readSystemNetwork,
  readSystemServices,
  readSystemLogs,
  triggerMaintenanceRun,
} from '../services/SystemDashboardService'

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

  app.get('/system/services', async () => readSystemServices())

  app.get('/system/network', async () => readSystemNetwork())

  app.get('/system/cpu-history', async () => readCpuHistory12h())

  app.get('/system/disk-dirs', async () => readDiskDirs())

  app.get('/maintenance/runs', async () => readMaintenanceRuns())

  app.get('/maintenance/status', async () => readMaintenanceStatus())

  app.post('/maintenance/run', async (_request, reply) => {
    try {
      return await reply.code(202).send(await triggerMaintenanceRun())
    } catch (error) {
      return await reply.code(400).send({
        error: 'Maintenance run rejected',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get<{ Querystring: { level?: 'all' | 'err' | 'warn' | 'ok' | 'info'; limit?: string } }>(
    '/logs',
    async (request) => {
      const level = request.query.level ?? 'all'
      const limit = Math.max(1, Math.min(500, Number.parseInt(request.query.limit ?? '100', 10) || 100))
      return await readSystemLogs(level, limit)
    },
  )

  app.get('/security/status', async () => readSecurityStatus())

  app.get('/security/ssh-attempts', async () => readSshAttempts24h())
}
