export type ProjectStatus = 'online' | 'offline' | 'building' | 'error'

export interface Project {
  id: string
  name: string
  githubUrl: string
  branch: string
  status: ProjectStatus
  localPath: string
  lastDeployedAt: string | null
  createdAt: string
}
