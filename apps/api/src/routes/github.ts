import { Octokit } from '@octokit/rest'
import type { FastifyInstance } from 'fastify'

function parseGithubOwnerRepo(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  // https://github.com/owner/repo(.git)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed)
      if (u.hostname !== 'github.com') return null
      const parts = u.pathname.replace(/^\//, '').replace(/\.git$/i, '').split('/')
      if (parts.length < 2) return null
      const [owner, repo] = parts
      if (!owner || !repo) return null
      return { owner, repo }
    } catch {
      return null
    }
  }

  // git@github.com:owner/repo(.git)
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    const owner = sshMatch[1]
    const repo = sshMatch[2]
    if (!owner || !repo) return null
    return { owner, repo }
  }

  return null
}

export async function registerGithubRoutes(app: FastifyInstance): Promise<void> {
  app.get('/github/repos', async (request, reply) => {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return []
    }
    try {
      const octokit = new Octokit({ auth: token })
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
      })
      return data.map((r) => ({
        name: r.name,
        fullName: r.full_name,
        cloneUrl: r.clone_url,
        defaultBranch: r.default_branch ?? 'main',
      }))
    } catch (err) {
      return reply.code(502).send({
        error: 'GitHub API failed',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })

  app.get<{ Querystring: { url?: string } }>('/github/branches', async (request, reply) => {
    const url = request.query.url?.trim() ?? ''
    const parsed = parseGithubOwnerRepo(url)
    if (!parsed) {
      return reply.code(400).send({ error: 'Invalid GitHub URL' })
    }

    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return { defaultBranch: 'main', branches: [] as string[] }
    }

    try {
      const octokit = new Octokit({ auth: token })
      const repoInfo = await octokit.rest.repos.get({ owner: parsed.owner, repo: parsed.repo })
      const defaultBranch = repoInfo.data.default_branch ?? 'main'

      const branches: string[] = []
      for await (const response of octokit.paginate.iterator(octokit.rest.repos.listBranches, {
        owner: parsed.owner,
        repo: parsed.repo,
        per_page: 100,
      })) {
        for (const b of response.data) {
          if (b.name) branches.push(b.name)
        }
      }
      branches.sort((a, b) => a.localeCompare(b))
      return { defaultBranch, branches }
    } catch (err) {
      return reply.code(502).send({
        error: 'GitHub API failed',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })
}
