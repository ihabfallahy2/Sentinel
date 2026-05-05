import type { Project } from '@sentinel/shared-types'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { readDb, writeDb } from '../db/store'
import { createProjectBodySchema, parseProjects } from '../schemas/project'
import { cloneGithubRepo } from '../services/GitService'
import { runComposeUp, streamComposeLogs } from '../services/DockerService'

function slugFromGithubUrl(url: string): string {
  const normalized = url.replace(/\.git$/i, '').replace(/\/$/, '')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last && last.length > 0 ? last : `repo-${randomUUID().slice(0, 8)}`
}

function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'project'
}

export async function registerProjectsRoutes(
  app: FastifyInstance,
  dataDir: string,
  projectsDir: string,
): Promise<void> {
  app.get('/projects', async () => {
    const db = await readDb(dataDir)
    return parseProjects(db.projects as unknown[])
  })

  app.post('/projects', async (request, reply) => {
    const parsed = createProjectBodySchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      return
    }
    const { githubUrl, branch } = parsed.data
    const displayName = parsed.data.name ?? slugFromGithubUrl(githubUrl)
    const id = randomUUID()
    const localPath = join(projectsDir, id)

    try {
      await cloneGithubRepo({ url: githubUrl, branch, targetDir: localPath })
    } catch (err) {
      await reply.code(400).send({
        error: 'Clone failed',
        message: err instanceof Error ? err.message : String(err),
      })
      try {
        await rm(localPath, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      return
    }

    const project: Project = {
      id,
      name: sanitizeDirName(displayName),
      githubUrl,
      branch,
      status: 'offline',
      localPath,
      lastDeployedAt: null,
      createdAt: new Date().toISOString(),
    }

    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    projects.push(project)
    db.projects = projects
    await writeDb(dataDir, db)

    await reply.code(201).send(project)
  })

  app.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    return project
  })

  app.delete<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const idx = projects.findIndex((p) => p.id === request.params.id)
    if (idx === -1) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const [removed] = projects.splice(idx, 1)
    db.projects = projects
    await writeDb(dataDir, db)
    try {
      await rm(removed.localPath, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    await reply.code(204).send()
  })

  app.post<{ Params: { id: string } }>('/projects/:id/deploy', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }

    project.status = 'building'
    db.projects = projects
    await writeDb(dataDir, db)

    const result = await runComposeUp(project.localPath)

    const updated = await readDb(dataDir)
    const list = parseProjects(updated.projects as unknown[])
    const p = list.find((x) => x.id === project.id)
    if (!p) {
      await reply.code(500).send({ error: 'Project lost after deploy' })
      return
    }
    if (result.code === 0) {
      p.status = 'online'
      p.lastDeployedAt = new Date().toISOString()
    } else {
      p.status = 'error'
    }
    updated.projects = list
    await writeDb(dataDir, updated)

    if (result.code !== 0) {
      await reply.code(500).send({
        error: 'Deploy failed',
        stderr: result.stderr.slice(-4000),
        project: p,
      })
      return
    }
    return p
  })

  app.get<{ Params: { id: string } }>(
    '/projects/:id/logs/stream',
    async (request, reply) => {
      const db = await readDb(dataDir)
      const projects = parseProjects(db.projects as unknown[])
      const project = projects.find((p) => p.id === request.params.id)
      if (!project) {
        await reply.code(404).send({ error: 'Not found' })
        return
      }

      const pass = new PassThrough()
      reply.header('Content-Type', 'text/event-stream; charset=utf-8')
      reply.header('Cache-Control', 'no-cache, no-transform')
      reply.header('Connection', 'keep-alive')

      const child = streamComposeLogs(project.localPath)
      const send = (chunk: Buffer) => {
        const text = chunk.toString('utf-8')
        const lines = text.split('\n').filter((l) => l.length > 0)
        for (const line of lines) {
          pass.push(`data: ${JSON.stringify(line)}\n\n`)
        }
      }

      child.stdout?.on('data', send)
      child.stderr?.on('data', send)
      child.on('error', (err) => {
        pass.push(`data: ${JSON.stringify(`[sentinel] ${String(err)}`)}\n\n`)
      })
      child.on('close', () => {
        pass.end()
      })

      request.raw.on('close', () => {
        child.kill('SIGTERM')
        pass.destroy()
      })

      return reply.send(pass)
    },
  )
}
