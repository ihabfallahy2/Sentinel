import type { Project } from '@sentinel/shared-types'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { readDb } from '../db/store'
import { parseProjects } from '../schemas/project'
import { composeCommand } from '../services/DockerService'

const executeSchema = z.object({
  type: z.enum([
    'action_button',
    'rest_explorer',
    'docker_control',
    'script_runner',
  ]),
  projectId: z.string().uuid().optional(),
  config: z.record(z.unknown()),
})

async function getProject(
  dataDir: string,
  projectId: string | undefined,
): Promise<Project | null> {
  if (!projectId) {
    return null
  }
  const db = await readDb(dataDir)
  const projects = parseProjects(db.projects as unknown[])
  return projects.find((p) => p.id === projectId) ?? null
}

export async function registerWidgetRoutes(
  app: FastifyInstance,
  dataDir: string,
): Promise<void> {
  app.post('/widgets/execute', async (request, reply) => {
    const parsed = executeSchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      return
    }
    const { type, projectId, config } = parsed.data
    const project = await getProject(dataDir, projectId)

    if (type === 'action_button' || type === 'rest_explorer') {
      const url = String(config.url ?? '')
      const method = String(config.method ?? 'GET').toUpperCase()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await reply.code(400).send({ error: 'url must be http(s)' })
        return
      }
      try {
        const res = await fetch(url, {
          method,
          headers: (config.headers as Record<string, string> | undefined) ?? undefined,
          body: typeof config.body === 'string' && method !== 'GET' ? config.body : undefined,
        })
        const text = await res.text()
        return {
          ok: res.ok,
          status: res.status,
          body: text.slice(0, 8000),
        }
      } catch (err) {
        await reply.code(502).send({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
        return
      }
    }

    if (type === 'docker_control') {
      if (!project) {
        await reply.code(400).send({ error: 'projectId required' })
        return
      }
      const action = String(config.action ?? 'restart')
      let result
      if (action === 'start') {
        result = await composeCommand(project.localPath, ['start'])
      } else if (action === 'stop') {
        result = await composeCommand(project.localPath, ['stop'])
      } else if (action === 'restart') {
        result = await composeCommand(project.localPath, ['restart'])
      } else if (action === 'rebuild' || action === 'up') {
        result = await composeCommand(project.localPath, ['up', '-d', '--build'])
      } else if (action === 'down') {
        result = await composeCommand(project.localPath, ['down'])
      } else {
        await reply.code(400).send({ error: 'unknown docker action' })
        return
      }
      return {
        ok: result.code === 0,
        code: result.code,
        stderr: result.stderr.slice(-4000),
        stdout: result.stdout.slice(-4000),
      }
    }

    if (type === 'script_runner') {
      if (!project) {
        await reply.code(400).send({ error: 'projectId required' })
        return
      }
      const path = String(config.path ?? '')
      const { runScriptSync } = await import('../services/ScriptService')
      const args = Array.isArray(config.args) ? config.args.map(String) : []
      const r = await runScriptSync(project.localPath, path, args)
      return {
        ok: r.code === 0,
        code: r.code,
        stdout: r.stdout.slice(-8000),
        stderr: r.stderr.slice(-8000),
      }
    }

    await reply.code(400).send({ error: 'unsupported' })
  })
}
