import { spawn, type ChildProcess } from 'node:child_process'

function dockerComposeArgs(subcommand: string[]): string[] {
  return ['compose', ...subcommand]
}

export function runComposeUp(cwd: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', dockerComposeArgs(['up', '-d', '--build']), {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => {
      resolve({ code: 1, stderr: String(err) })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr })
    })
  })
}

export function streamComposeLogs(cwd: string): ChildProcess {
  return spawn('docker', dockerComposeArgs(['logs', '-f', '--tail', '100']), {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}
