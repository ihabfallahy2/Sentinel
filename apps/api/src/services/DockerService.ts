import { spawn, type ChildProcess } from 'node:child_process'

function dockerComposeArgs(subcommand: string[]): string[] {
  return ['compose', ...subcommand]
}

export function composeCommand(
  cwd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', dockerComposeArgs(args), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${String(err)}` })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export async function getComposePsJson(cwd: string): Promise<unknown[]> {
  const r = await composeCommand(cwd, ['ps', '-a', '--format', 'json'])
  if (r.code !== 0) {
    return []
  }
  const t = r.stdout.trim()
  if (!t) {
    return []
  }
  const lines = t.split('\n').filter(Boolean)
  const out: unknown[] = []
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as unknown)
    } catch {
      /* ignore line */
    }
  }
  return out
}

export function runComposeUp(cwd: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return composeCommand(cwd, ['up', '-d', '--build'])
}

export function runComposeStart(cwd: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return composeCommand(cwd, ['start'])
}

export function runComposeStop(cwd: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return composeCommand(cwd, ['stop'])
}

export function runComposeRestart(cwd: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return composeCommand(cwd, ['restart'])
}

export function runComposeDown(cwd: string): Promise<{ code: number; stderr: string; stdout: string }> {
  return composeCommand(cwd, ['down'])
}

export function streamComposeLogs(cwd: string): ChildProcess {
  return spawn('docker', dockerComposeArgs(['logs', '-f', '--tail', '100']), {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
