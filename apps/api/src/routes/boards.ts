import type { Board, BoardDetail, BoardSummary, Project, ProjectStatus } from '@sentinel/shared-types'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { readDb, writeDb } from '../db/store'
import { canvasLayoutSchema } from '../schemas/canvas'
import {
  boardSchema,
  createBoardBodySchema,
  importBoardProjectBodySchema,
  parseBoards,
} from '../schemas/board'
import { parseProjects } from '../schemas/project'
import { cloneGithubRepo } from '../services/GitService'

function slugFromGithubUrl(url: string): string {
  const normalized = url.replace(/\.git$/i, '').replace(/\/$/, '')
  const parts = normalized.split('/')
  const last = parts[parts.length - 1]
  return last && last.length > 0 ? last : `repo-${randomUUID().slice(0, 8)}`
}

function sanitizeDirName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'project'
}

function aggregateStatus(projects: Project[]): ProjectStatus {
  if (projects.some((p) => p.status === 'error')) return 'error'
  if (projects.some((p) => p.status === 'building')) return 'building'
  if (projects.some((p) => p.status === 'online')) return 'online'
  return 'offline'
}

function toSummary(board: Board, projects: Project[]): BoardSummary {
  return {
    ...board,
    projectCount: projects.length,
    status: aggregateStatus(projects),
  }
}

export async function registerBoardsRoutes(
  app: FastifyInstance,
  dataDir: string,
  projectsDir: string,
): Promise<void> {
  app.get('/boards', async () => {
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    const projects = parseProjects(db.projects as unknown[])
    return boards.map((board) =>
      toSummary(
        board,
        projects.filter((project) => board.projectIds.includes(project.id)),
      ),
    )
  })

  app.post('/boards', async (request, reply) => {
    const parsed = createBoardBodySchema.safeParse(request.body)
    if (!parsed.success) {
      await reply.code(400).send({ error: 'Invalid body', details: parsed.error.flatten() })
      return
    }
    const now = new Date().toISOString()
    const board: Board = {
      id: randomUUID(),
      name: parsed.data.name.trim(),
      projectIds: [],
      createdAt: now,
      updatedAt: now,
    }
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    boards.push(board)
    db.boards = boards
    await writeDb(dataDir, db)
    await reply.code(201).send(board)
  })

  app.get<{ Params: { id: string } }>('/boards/:id', async (request, reply) => {
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    const board = boards.find((item) => item.id === request.params.id)
    if (!board) {
      await reply.code(404).send({ error: 'Not found' })
      return
    }
    const projects = parseProjects(db.projects as unknown[]).filter((project) =>
      board.projectIds.includes(project.id),
    )
    const detail: BoardDetail = { ...board, projects }
    return detail
  })

  app.post<{ Params: { id: string } }>('/boards/:id/projects/import', async (request, reply) => {
    const parsedBody = importBoardProjectBodySchema.safeParse(request.body)
    if (!parsedBody.success) {
      await reply.code(400).send({ error: 'Invalid body', details: parsedBody.error.flatten() })
      return
    }
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    const board = boards.find((item) => item.id === request.params.id)
    if (!board) {
      await reply.code(404).send({ error: 'Board not found' })
      return
    }

    const { githubUrl, branch } = parsedBody.data
    const displayName = parsedBody.data.name ?? slugFromGithubUrl(githubUrl)
    const projectId = randomUUID()
    const localPath = join(projectsDir, projectId)

    let resolvedBranch = branch
    try {
      resolvedBranch = await cloneGithubRepo({ url: githubUrl, branch, targetDir: localPath })
    } catch (err) {
      await reply.code(400).send({
        error: 'Clone failed',
        message: err instanceof Error ? err.message : String(err),
      })
      try {
        await rm(localPath, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
      return
    }

    const project: Project = {
      id: projectId,
      name: sanitizeDirName(displayName),
      githubUrl,
      branch: resolvedBranch,
      status: 'offline',
      localPath,
      lastDeployedAt: null,
      createdAt: new Date().toISOString(),
    }

    const projects = parseProjects(db.projects as unknown[])
    projects.push(project)
    board.projectIds.push(project.id)
    board.updatedAt = new Date().toISOString()

    db.projects = projects
    db.boards = boards
    await writeDb(dataDir, db)
    await reply.code(201).send(project)
  })

  app.delete<{ Params: { id: string; projectId: string } }>(
    '/boards/:id/projects/:projectId',
    async (request, reply) => {
      const db = await readDb(dataDir)
      const boards = parseBoards(db.boards as unknown[])
      const board = boards.find((item) => item.id === request.params.id)
      if (!board) {
        await reply.code(404).send({ error: 'Board not found' })
        return
      }
      board.projectIds = board.projectIds.filter((projectId) => projectId !== request.params.projectId)
      board.updatedAt = new Date().toISOString()
      db.boards = boards
      await writeDb(dataDir, db)
      await reply.code(204).send()
    },
  )

  app.get<{ Params: { id: string } }>('/boards/:id/canvas', async (request, reply) => {
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    if (!boards.some((board) => board.id === request.params.id)) {
      await reply.code(404).send({ error: 'Board not found' })
      return
    }
    const raw = db.canvasLayouts[request.params.id]
    const parsed = canvasLayoutSchema.safeParse(raw)
    if (!parsed.success) {
      return { nodes: [], edges: [] }
    }
    return parsed.data
  })

  app.put<{ Params: { id: string } }>('/boards/:id/canvas', async (request, reply) => {
    const db = await readDb(dataDir)
    const boards = parseBoards(db.boards as unknown[])
    if (!boards.some((board) => board.id === request.params.id)) {
      await reply.code(404).send({ error: 'Board not found' })
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

  // Keep schema in this module for easy reference in route typing checks.
  void boardSchema
}
