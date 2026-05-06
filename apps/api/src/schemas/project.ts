import type { Project } from '@sentinel/shared-types'
import { z } from 'zod'

export const createProjectBodySchema = z.object({
  githubUrl: z.string().url(),
  name: z.string().min(1).max(120).optional(),
  branch: z.string().min(1).max(200).default('main'),
})

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>

export const projectSchema: z.ZodType<Project> = z.object({
  id: z.string().uuid(),
  name: z.string(),
  githubUrl: z.string(),
  branch: z.string(),
  status: z.enum(['online', 'offline', 'building', 'error']),
  localPath: z.string(),
  lastDeployedAt: z.string().nullable(),
  createdAt: z.string(),
})

export function parseProjects(raw: unknown[]): Project[] {
  const out: Project[] = []
  for (const item of raw) {
    const parsed = projectSchema.safeParse(item)
    if (parsed.success) {
      out.push(parsed.data)
    }
  }
  return out
}
