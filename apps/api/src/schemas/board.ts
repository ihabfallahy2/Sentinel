import type { Board } from '@sentinel/shared-types'
import { z } from 'zod'

export const createBoardBodySchema = z.object({
  name: z.string().min(1).max(120),
})

export const importBoardProjectBodySchema = z.object({
  githubUrl: z.string().url(),
  name: z.string().min(1).max(120).optional(),
  branch: z.string().min(1).max(200).default('main'),
})

export const boardSchema: z.ZodType<Board> = z.object({
  id: z.string().uuid(),
  name: z.string(),
  projectIds: z.array(z.string().uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export function parseBoards(raw: unknown[]): Board[] {
  const out: Board[] = []
  for (const item of raw) {
    const parsed = boardSchema.safeParse(item)
    if (parsed.success) {
      out.push(parsed.data)
    }
  }
  return out
}
