export type DeploymentStatus = 'success' | 'failed' | 'building' | 'rolled_back'

export interface Deployment {
  id: string
  projectId: string
  commitSha: string
  commitMessage: string
  status: DeploymentStatus
  startedAt: string
  finishedAt: string | null
  logs: string[]
}
