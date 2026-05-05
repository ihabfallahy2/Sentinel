import type { FastifyInstance } from 'fastify'
import { readDb } from '../db/store'

export async function registerProjectsRoutes(
  app: FastifyInstance,
  dataDir: string,
): Promise<void> {
  app.get('/projects', async () => {
    const db = await readDb(dataDir)
    return db.projects
  })
}
