export type WidgetStatus = 'idle' | 'running' | 'success' | 'error'

export type WidgetType =
  | 'action_button'
  | 'rest_explorer'
  | 'job_monitor'
  | 'metric_card'
  | 'log_stream'
  | 'workflow'
  | 'script_runner'
  | 'docker_control'
  | 'system_stats'
  | 'deploy_card'
  | 'env_editor'

export interface BaseWidget {
  id: string
  type: WidgetType
  position: { x: number; y: number }
  config: Record<string, unknown>
  status: WidgetStatus
}
