import type { FastifyReply, FastifyRequest } from 'fastify'

export function requireApiKey(expectedKey: string | undefined) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!expectedKey) {
      await reply.code(500).send({ error: 'SENTINEL_API_KEY is not configured' })
      return
    }
    const header = request.headers['x-api-key']
    const key = Array.isArray(header) ? header[0] : header
    if (key !== expectedKey) {
      await reply.code(401).send({ error: 'Unauthorized' })
    }
  }
}
