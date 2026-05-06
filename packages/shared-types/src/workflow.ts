export type WorkflowStepType = 'rest' | 'script' | 'docker'

export interface WorkflowStepBase {
  id?: string
}

export interface WorkflowRestStep extends WorkflowStepBase {
  type: 'rest'
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface WorkflowScriptStep extends WorkflowStepBase {
  type: 'script'
  path: string
}

export interface WorkflowDockerStep extends WorkflowStepBase {
  type: 'docker'
  action: 'up' | 'down' | 'restart' | 'rebuild'
}

export type WorkflowStep = WorkflowRestStep | WorkflowScriptStep | WorkflowDockerStep
