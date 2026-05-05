import type { CanvasLayout } from '@sentinel/shared-types'
import { z } from 'zod'

export const canvasLayoutSchema: z.ZodType<CanvasLayout> = z.object({
  nodes: z.array(z.record(z.unknown())),
  edges: z.array(z.record(z.unknown())),
})
