import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

function resolveScript(projectPath: string, relativePath: string): string | null {
  const abs = resolve(projectPath, relativePath)
  const base = resolve(projectPath)
  if (!abs.startsWith(base)) {
    return null
  }
  return abs
}

function spawnForScript(
  absPath: string,
  projectPath: string,
  args: string[],
): ChildProcess {
  const lower = absPath.toLowerCase()
  if (lower.endsWith('.sh')) {
    return spawn('bash', [absPath, ...args], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  if (lower.endsWith('.py')) {
    return spawn('python3', [absPath, ...args], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  if (lower.endsWith('.js')) {
    return spawn(process.execPath, [absPath, ...args], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  return spawn(absPath, args, {
    cwd: projectPath,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function runScriptSync(
  projectPath: string,
  relativePath: string,
  args: string[] = [],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const abs = resolveScript(projectPath, relativePath)
  if (!abs) {
    return Promise.resolve({ code: 1, stdout: '', stderr: 'Invalid script path' })
  }
  return new Promise((resolveCb) => {
    const child = spawnForScript(abs, projectPath, args)
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    child.on('error', (err) => {
      resolveCb({ code: 1, stdout, stderr: `${stderr}${String(err)}` })
    })
    child.on('close', (code) => {
      resolveCb({ code: code ?? 1, stdout, stderr })
    })
  })
}

export function streamScript(
  projectPath: string,
  relativePath: string,
  args: string[] = [],
): ChildProcess | null {
  const abs = resolveScript(projectPath, relativePath)
  if (!abs) {
    return null
  }
  return spawnForScript(abs, projectPath, args)
}
