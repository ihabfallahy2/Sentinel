import cors from '@fastify/cors'
import Fastify from 'fastify'
import { join } from 'node:path'
import { readDb } from './db/store'
import { requireApiKey } from './middleware/auth'
import { registerProjectsRoutes } from './routes/projects'

const port = Number(process.env.SENTINEL_PORT ?? '3500')
const dataDir = process.env.SENTINEL_DATA_DIR ?? './data'
const projectsDir =
  process.env.SENTINEL_PROJECTS_DIR ?? join(process.cwd(), 'projects')
const apiKey = process.env.SENTINEL_API_KEY

async function main(): Promise<void> {
  await readDb(dataDir)

  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true })

  app.get('/health', async () => ({ status: 'ok' }))

  const auth = requireApiKey(apiKey)
  await app.register(
    async (api) => {
      api.addHook('preHandler', auth)
      await registerProjectsRoutes(api, dataDir, projectsDir)
    },
    { prefix: '/api' },
  )

  await app.listen({ port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
