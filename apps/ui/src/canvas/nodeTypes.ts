import type { NodeTypes } from '@xyflow/react'
import { ActionButtonNode } from './nodes/ActionButtonNode'
import { DeployCardNode } from './nodes/DeployCardNode'
import { DockerControlNode } from './nodes/DockerControlNode'
import { EnvEditorNode } from './nodes/EnvEditorNode'
import { JobMonitorNode } from './nodes/JobMonitorNode'
import { LogStreamNode } from './nodes/LogStreamNode'
import { MetricCardNode } from './nodes/MetricCardNode'
import { ProjectNode } from './nodes/ProjectNode'
import { RestExplorerNode } from './nodes/RestExplorerNode'
import { ScriptRunnerNode } from './nodes/ScriptRunnerNode'
import { SystemStatsNode } from './nodes/SystemStatsNode'
import { WorkflowNode } from './nodes/WorkflowNode'

export const nodeTypes: NodeTypes = {
  deploy_card: DeployCardNode,
  project_node: ProjectNode,
  log_stream: LogStreamNode,
  docker_control: DockerControlNode,
  env_editor: EnvEditorNode,
  script_runner: ScriptRunnerNode,
  rest_explorer: RestExplorerNode,
  action_button: ActionButtonNode,
  job_monitor: JobMonitorNode,
  metric_card: MetricCardNode,
  workflow: WorkflowNode,
  system_stats: SystemStatsNode,
}
