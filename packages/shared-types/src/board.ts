import type { Project, ProjectStatus } from './project'

export interface Board {
  id: string
  name: string
  projectIds: string[]
  createdAt: string
  updatedAt: string
}

export interface BoardSummary extends Board {
  projectCount: number
  status: ProjectStatus
}

export interface BoardDetail extends Board {
  projects: Project[]
}
