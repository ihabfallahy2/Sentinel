import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type SentinelDb = {
  projects: unknown[]
  boards: unknown[]
  deployments: unknown[]
  canvasLayouts: Record<string, unknown>
}

const defaultDb: SentinelDb = {
  projects: [],
  boards: [],
  deployments: [],
  canvasLayouts: {},
}

export function dbPath(dataDir: string): string {
  return join(dataDir, 'sentinel.json')
}

export async function readDb(dataDir: string): Promise<SentinelDb> {
  const path = dbPath(dataDir)
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SentinelDb>
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      boards: Array.isArray(parsed.boards) ? parsed.boards : [],
      deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [],
      canvasLayouts:
        parsed.canvasLayouts && typeof parsed.canvasLayouts === 'object'
          ? parsed.canvasLayouts
          : {},
    }
  } catch {
    return structuredClone(defaultDb)
  }
}

export async function writeDb(dataDir: string, db: SentinelDb): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await writeFile(dbPath(dataDir), JSON.stringify(db, null, 2), 'utf-8')
}
