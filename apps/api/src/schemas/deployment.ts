import type { Deployment } from '@sentinel/shared-types'
import { z } from 'zod'

export const deploymentSchema: z.ZodType<Deployment> = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  commitSha: z.string(),
  commitMessage: z.string(),
  status: z.enum(['success', 'failed', 'building', 'rolled_back']),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  logs: z.array(z.string()),
})

export function parseDeployments(raw: unknown[]): Deployment[] {
  const out: Deployment[] = []
  for (const item of raw) {
    const p = deploymentSchema.safeParse(item)
    if (p.success) {
      out.push(p.data)
    }
  }
  return out
}
