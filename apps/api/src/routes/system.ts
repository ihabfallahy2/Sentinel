import type { FastifyInstance } from 'fastify'
import { getSystemStats, listDockerContainers } from '../services/SystemService'

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/system/stats', async () => getSystemStats())
  app.get('/system/docker/containers', async () => listDockerContainers())
}
