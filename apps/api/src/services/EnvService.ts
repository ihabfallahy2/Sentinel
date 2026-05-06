import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function readEnvFile(projectPath: string): Promise<string> {
  const path = join(projectPath, '.env')
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return ''
  }
}

export async function writeEnvFile(projectPath: string, content: string): Promise<void> {
  const path = join(projectPath, '.env')
  await writeFile(path, content, 'utf-8')
}

export async function readEnvExample(projectPath: string): Promise<string | null> {
  const path = join(projectPath, '.env.example')
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}
