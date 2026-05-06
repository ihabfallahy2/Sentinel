import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import simpleGit from 'simple-git'

export async function cloneGithubRepo(options: {
  url: string
  branch: string
  targetDir: string
}): Promise<void> {
  await mkdir(dirname(options.targetDir), { recursive: true })
  const git = simpleGit()
  await git.clone(options.url, options.targetDir, [
    '--branch',
    options.branch,
    '--depth',
    '40',
    '--single-branch',
  ])
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
