import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import simpleGit from 'simple-git'

async function getRemoteHeadBranch(url: string): Promise<string | null> {
  const git = simpleGit()
  const out = await git.raw(['ls-remote', '--symref', url, 'HEAD'])
  const line = out
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('ref: '))
  if (!line) return null
  const match = line.match(/ref:\s+refs\/heads\/([^\s]+)\s+HEAD/i)
  return match?.[1] ?? null
}

async function getRemoteBranches(url: string): Promise<string[]> {
  const git = simpleGit()
  const out = await git.raw(['ls-remote', '--heads', url])
  return out
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split('\t')[1] ?? '')
    .filter((ref) => ref.startsWith('refs/heads/'))
    .map((ref) => ref.replace('refs/heads/', ''))
}

export async function cloneGithubRepo(options: {
  url: string
  branch: string
  targetDir: string
}): Promise<string> {
  await mkdir(dirname(options.targetDir), { recursive: true })
  const git = simpleGit()
  const remoteBranches: string[] = await getRemoteBranches(options.url).catch(
    () => [] as string[],
  )
  const requestedBranch = options.branch.trim()
  const resolvedBranch =
    requestedBranch.length > 0 && remoteBranches.includes(requestedBranch)
      ? requestedBranch
      : await getRemoteHeadBranch(options.url).catch(() => null)

  try {
    await git.clone(options.url, options.targetDir, [
      '--branch',
      resolvedBranch || options.branch,
      '--depth',
      '40',
      '--single-branch',
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const missingBranch = /Remote branch .* not found in upstream origin/i.test(message)
    if (!missingBranch) {
      throw err
    }
    // Fallback: clone default branch when requested branch does not exist.
    await git.clone(options.url, options.targetDir, ['--depth', '40'])
  }

  const repo = simpleGit({ baseDir: options.targetDir })
  const local = await repo.branchLocal()
  return local.current || resolvedBranch || options.branch
}

export async function getHeadSummary(cwd: string): Promise<{ sha: string; message: string }> {
  const git = simpleGit({ baseDir: cwd })
  const log = await git.log({ maxCount: 1 })
  const latest = log.latest
  if (!latest) {
    return { sha: 'unknown', message: '' }
  }
  return { sha: latest.hash, message: latest.message }
}

export async function pullProject(cwd: string, branch: string): Promise<void> {
  const git = simpleGit({ baseDir: cwd })
  try {
    await git.fetch('origin', branch, ['--depth', '40'])
  } catch {
    await git.fetch('origin', branch)
  }
  await git.checkout(branch)
  await git.pull('origin', branch)
}

export async function checkoutCommit(cwd: string, sha: string): Promise<void> {
  const git = simpleGit({ baseDir: cwd })
  try {
    await git.fetch('origin', ['--depth', '40'])
  } catch {
    await git.fetch('origin')
  }
  await git.checkout(sha)
}
