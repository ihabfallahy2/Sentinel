import { Octokit } from '@octokit/rest'
import type { FastifyInstance } from 'fastify'

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
}
