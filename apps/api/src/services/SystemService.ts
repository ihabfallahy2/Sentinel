import { spawn } from 'node:child_process'
import si from 'systeminformation'

function runDocker(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${String(err)}` })
    })
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export async function getSystemStats(): Promise<{
  cpu: { load: number }
  mem: { total: number; used: number; free: number }
  disk?: { size: number; used: number; available: number; mount: string }
  uptime: number
}> {
  const [load, mem, fs, uptime] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time(),
  ])
  const disk = fs[0]
  return {
    cpu: { load: load.currentLoad },
    mem: { total: mem.total, used: mem.used, free: mem.free },
    disk: disk
      ? {
          size: disk.size,
          used: disk.used,
          available: disk.available,
          mount: disk.mount,
        }
      : undefined,
    uptime: uptime.uptime,
  }
}

/** `docker ps -a` en formato JSON por línea (Docker CLI reciente). */
export async function listDockerContainers(): Promise<unknown[]> {
  const r = await runDocker(['ps', '-a', '--format', '{{json .}}'])
  if (r.code !== 0) {
    return [{ error: r.stderr || 'docker ps failed' }]
  }
  const lines = r.stdout.trim().split('\n').filter(Boolean)
  const out: unknown[] = []
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as unknown)
    } catch {
      out.push({ raw: line })
    }
  }
  return out
}
