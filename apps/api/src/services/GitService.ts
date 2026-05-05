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
    '1',
    '--single-branch',
  ])
}
