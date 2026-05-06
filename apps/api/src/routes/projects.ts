import type { Deployment, Project } from '@sentinel/shared-types'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { readDb, writeDb } from '../db/store'
import { canvasLayoutSchema } from '../schemas/canvas'
import { parseDeployments } from '../schemas/deployment'
import { createProjectBodySchema, parseProjects } from '../schemas/project'
import {
  getComposePsJson,
  runComposeUp,
  streamComposeLogs,
} from '../services/DockerService'
import { readEnvExample, readEnvFile, writeEnvFile } from '../services/EnvService'
import { cloneGithubRepo, checkoutCommit, getHeadSummary, pullProject } from '../services/GitService'
import { runScriptSync, streamScript } from '../services/ScriptService'

function slugFromGithubUrl(url: string): string {
  const normalized = url.replace(/\.git$/i, '').replace(/\/$/, '')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last && last.length > 0 ? last : `repo-${randomUUID().slice(0, 8)}`
}

function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'project'
}

function logSlice(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0).slice(-80)
}

const deployBodySchema = z.object({
  pull: z.boolean().optional(),
})

const rollbackBodySchema = z.object({
  deploymentId: z.string().uuid(),
})

const envPutSchema = z.object({
  content: z.string(),
})

const scriptRunSchema = z.object({
  path: z.string().min(1),
  args: z.array(z.string()).optional(),
})

const workflowBodySchema = z.object({
  steps: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('rest'),
        id: z.string().optional(),
        method: z.string().optional(),
        url: z.string().url(),
        body: z.string().optional(),
        headers: z.record(z.string()).optional(),
      }),
      z.object({
        type: z.literal('script'),
        id: z.string().optional(),
        path: z.string().min(1),
      }),
      z.object({
        type: z.literal('docker'),
        id: z.string().optional(),
        action: z.enum(['up', 'down', 'restart', 'rebuild']),
      }),
    ]),
  ),
})

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
    const deps = parseDeployments(db.deployments as unknown[]).filter(
      (d) => d.projectId !== removed.id,
    )
    db.deployments = deps
    const layouts = { ...db.canvasLayouts }
    delete layouts[removed.id]
    db.canvasLayouts = layouts
    await writeDb(dataDir, db)
    try {
      await rm(removed.localPath, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    await reply.code(204).send()
  })

  app.get<{ Params: { id: string } }>('/projects/:id/status', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const compose = await getComposePsJson(project.localPath)
    return { project, compose }
  })

  app.get<{ Params: { id: string } }>('/projects/:id/deployments', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    if (!projects.some((p) => p.id === request.params.id)) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const deps = parseDeployments(db.deployments as unknown[])
      .filter((d) => d.projectId === request.params.id)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    return deps
  })

  app.get<{ Params: { id: string } }>('/projects/:id/jobs', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    if (!projects.some((p) => p.id === request.params.id)) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const deps = parseDeployments(db.deployments as unknown[])
      .filter((d) => d.projectId === request.params.id)
      .slice(-20)
      .reverse()
    return deps.map((d) => ({
      id: d.id,
      status: d.status,
      startedAt: d.startedAt,
      finishedAt: d.finishedAt,
      commitSha: d.commitSha,
      commitMessage: d.commitMessage,
    }))
  })

  app.get<{ Params: { id: string } }>('/projects/:id/canvas', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    if (!projects.some((p) => p.id === request.params.id)) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const raw = db.canvasLayouts[request.params.id]
    const parsed = canvasLayoutSchema.safeParse(raw)
    if (!parsed.success) {
      return { nodes: [], edges: [] }
    }
    return parsed.data
  })

  app.put<{ Params: { id: string } }>('/projects/:id/canvas', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    if (!projects.some((p) => p.id === request.params.id)) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const parsed = canvasLayoutSchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid canvas', details: parsed.error.flatten() })
      return
    }
    db.canvasLayouts[request.params.id] = parsed.data
    await writeDb(dataDir, db)
    return parsed.data
  })

  app.get<{ Params: { id: string } }>('/projects/:id/env', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const content = await readEnvFile(project.localPath)
    return { content }
  })

  app.put<{ Params: { id: string } }>('/projects/:id/env', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const parsed = envPutSchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid body' })
      return
    }
    await writeEnvFile(project.localPath, parsed.data.content)
    return { ok: true }
  })

  app.get<{ Params: { id: string } }>('/projects/:id/env/diff', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const env = await readEnvFile(project.localPath)
    const example = await readEnvExample(project.localPath)
    return { env, example }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/docker/start', async (request, reply) => {
    const { composeCommand } = await import('../services/DockerService')
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const r = await composeCommand(project.localPath, ['start'])
    if (r.code !== 0) {
      await reply.code(500).send({ error: r.stderr })
      return
    }
    return { ok: true, stdout: r.stdout }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/docker/stop', async (request, reply) => {
    const { composeCommand } = await import('../services/DockerService')
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const r = await composeCommand(project.localPath, ['stop'])
    if (r.code !== 0) {
      await reply.code(500).send({ error: r.stderr })
      return
    }
    return { ok: true }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/docker/restart', async (request, reply) => {
    const { composeCommand } = await import('../services/DockerService')
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const r = await composeCommand(project.localPath, ['restart'])
    if (r.code !== 0) {
      await reply.code(500).send({ error: r.stderr })
      return
    }
    return { ok: true }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/docker/rebuild', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const r = await runComposeUp(project.localPath)
    if (r.code !== 0) {
      await reply.code(500).send({ error: r.stderr })
      return
    }
    return { ok: true, stdout: r.stdout }
  })

  app.post<{ Params: { id: string } }>('/projects/:id/scripts/run', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const parsed = scriptRunSchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid body' })
      return
    }
    const r = await runScriptSync(project.localPath, parsed.data.path, parsed.data.args ?? [])
    return { ok: r.code === 0, code: r.code, stdout: r.stdout, stderr: r.stderr }
  })

  app.get<{ Params: { id: string }; Querystring: { path: string } }>(
    '/projects/:id/scripts/run/stream',
    async (request, reply) => {
      const db = await readDb(dataDir)
      const projects = parseProjects(db.projects as unknown[])
      const project = projects.find((p) => p.id === request.params.id)
      if (!project) {
        await reply.code(404).send({ error: 'Not found' })
        return
      }
      const rel = request.query.path
      if (!rel || typeof rel !== 'string') {
        await reply.code(400).send({ error: 'path query required' })
        return
      }
      const child = streamScript(project.localPath, rel)
      if (!child) {
        await reply.code(400).send({ error: 'Invalid script path' })
        return
      }
      const pass = new PassThrough()
      reply.header('Content-Type', 'text/event-stream; charset=utf-8')
      reply.header('Cache-Control', 'no-cache, no-transform')
      reply.header('Connection', 'keep-alive')
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

  app.post<{ Params: { id: string } }>('/projects/:id/workflows/run', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const parsed = workflowBodySchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid workflow', details: parsed.error.flatten() })
      return
    }
    const steps = parsed.data.steps
    const pass = new PassThrough()
    reply.header('Content-Type', 'text/event-stream; charset=utf-8')
    reply.header('Cache-Control', 'no-cache, no-transform')
    reply.header('Connection', 'keep-alive')

    const emit = (obj: unknown) => {
      pass.push(`data: ${JSON.stringify(obj)}\n\n`)
    }

    void (async () => {
      const { composeCommand } = await import('../services/DockerService')
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const nodeId = step.id ?? `step-${i}`
        emit({ type: 'node_start', nodeId, step: step.type })
        try {
          if (step.type === 'rest') {
            const method = (step.method ?? 'GET').toUpperCase()
            const res = await fetch(step.url, {
              method,
              headers: step.headers,
              body: step.body,
            })
            const text = await res.text()
            emit({
              type: 'node_done',
              nodeId,
              status: res.ok ? 'success' : 'error',
              output: text.slice(0, 2000),
              httpStatus: res.status,
            })
            if (!res.ok) {
              break
            }
          } else if (step.type === 'script') {
            const r = await runScriptSync(project.localPath, step.path)
            emit({
              type: 'node_done',
              nodeId,
              status: r.code === 0 ? 'success' : 'error',
              stdout: r.stdout.slice(-2000),
              stderr: r.stderr.slice(-2000),
            })
            if (r.code !== 0) {
              break
            }
          } else if (step.type === 'docker') {
            let r
            if (step.action === 'up' || step.action === 'rebuild') {
              r = await runComposeUp(project.localPath)
            } else if (step.action === 'down') {
              r = await composeCommand(project.localPath, ['down'])
            } else if (step.action === 'restart') {
              r = await composeCommand(project.localPath, ['restart'])
            } else {
              r = { code: 1, stdout: '', stderr: 'unknown action' }
            }
            emit({
              type: 'node_done',
              nodeId,
              status: r.code === 0 ? 'success' : 'error',
              stderr: r.stderr?.slice(-2000),
              stdout: r.stdout?.slice(-2000),
            })
            if (r.code !== 0) {
              break
            }
          }
        } catch (err) {
          emit({
            type: 'node_done',
            nodeId,
            status: 'error',
            output: err instanceof Error ? err.message : String(err),
          })
          break
        }
      }
      emit({ type: 'workflow_done' })
      pass.end()
    })().catch((err) => {
      emit({ type: 'workflow_error', message: String(err) })
      pass.end()
    })

    request.raw.on('close', () => {
      pass.destroy()
    })

    return reply.send(pass)
  })

  async function appendDeployment(dep: Deployment): Promise<void> {
    const db = await readDb(dataDir)
    const list = parseDeployments(db.deployments as unknown[])
    list.push(dep)
    db.deployments = list
    await writeDb(dataDir, db)
  }

  app.post<{ Params: { id: string } }>('/projects/:id/deploy', async (request, reply) => {
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }

    const body = deployBodySchema.safeParse(request.body ?? {})
    if (body.success && body.data.pull) {
      try {
        await pullProject(project.localPath, project.branch)
      } catch (err) {
        app.log.warn({ err }, 'git pull failed before deploy')
      }
    }

    project.status = 'building'
    db.projects = projects
    await writeDb(dataDir, db)

    const startedAt = new Date().toISOString()
    const result = await runComposeUp(project.localPath)

    const updated = await readDb(dataDir)
    const list = parseProjects(updated.projects as unknown[])
    const p = list.find((x) => x.id === project.id)
    if (!p) {
      await reply.code(500).send({ error: 'Project lost after deploy' })
      return
    }

    const logLines = logSlice(`${result.stdout}\n${result.stderr}`)

    if (result.code === 0) {
      const head = await getHeadSummary(p.localPath)
      p.status = 'online'
      p.lastDeployedAt = new Date().toISOString()
      updated.projects = list
      await writeDb(dataDir, updated)
      const dep: Deployment = {
        id: randomUUID(),
        projectId: p.id,
        commitSha: head.sha,
        commitMessage: head.message,
        status: 'success',
        startedAt,
        finishedAt: new Date().toISOString(),
        logs: logLines,
      }
      await appendDeployment(dep)
      return p
    }

    p.status = 'error'
    updated.projects = list
    await writeDb(dataDir, updated)
    const dep: Deployment = {
      id: randomUUID(),
      projectId: p.id,
      commitSha: 'unknown',
      commitMessage: '',
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      logs: logLines,
    }
    await appendDeployment(dep)

    await reply.code(500).send({
      error: 'Deploy failed',
      stderr: result.stderr.slice(-4000),
      project: p,
    })
  })

  app.post<{ Params: { id: string } }>('/projects/:id/rollback', async (request, reply) => {
    const parsed = rollbackBodySchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'deploymentId required' })
      return
    }
    const db = await readDb(dataDir)
    const projects = parseProjects(db.projects as unknown[])
    const project = projects.find((p) => p.id === request.params.id)
    if (!project) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const deps = parseDeployments(db.deployments as unknown[])
    const target = deps.find((d) => d.id === parsed.data.deploymentId && d.projectId === project.id)
    if (!target || target.commitSha === 'unknown') {
      await reply.code(404).send({ error: 'Deployment not found' })
      return
    }

    try {
      await checkoutCommit(project.localPath, target.commitSha)
    } catch (err) {
      await reply.code(400).send({
        error: 'Checkout failed',
        message: err instanceof Error ? err.message : String(err),
      })
      return
    }

    const startedAt = new Date().toISOString()
    const result = await runComposeUp(project.localPath)
    const head = await getHeadSummary(project.localPath).catch(() => ({
      sha: target.commitSha,
      message: `rollback:${target.commitMessage}`,
    }))

    const updated = await readDb(dataDir)
    const list = parseProjects(updated.projects as unknown[])
    const p = list.find((x) => x.id === project.id)
    if (!p) {
      await reply.code(500).send({ error: 'Project lost' })
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

    const dep: Deployment = {
      id: randomUUID(),
      projectId: p.id,
      commitSha: head.sha,
      commitMessage: `Rollback → ${target.commitMessage}`.slice(0, 500),
      status: result.code === 0 ? 'rolled_back' : 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      logs: logSlice(`${result.stdout}\n${result.stderr}`),
    }
    await appendDeployment(dep)

    if (result.code !== 0) {
      await reply.code(500).send({ error: 'Rollback deploy failed', stderr: result.stderr, project: p })
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
