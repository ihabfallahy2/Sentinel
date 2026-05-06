import type { FastifyReply, FastifyRequest } from 'fastify'

function extractKey(request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key']
  if (Array.isArray(header)) {
    return header[0]
  }
  if (typeof header === 'string') {
    return header
  }
  const q = request.query as { apiKey?: string }
  if (typeof q?.apiKey === 'string' && q.apiKey.length > 0) {
    return q.apiKey
  }
  return undefined
}

export function requireApiKey(expectedKey: string | undefined) {
  return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!expectedKey) {
      await reply.code(500).send({ error: 'SENTINEL_API_KEY is not configured' })
      return
    }
    const key = extractKey(request)
    if (key !== expectedKey) {
      await reply.code(401).send({ error: 'Unauthorized' })
    }
  }
}
