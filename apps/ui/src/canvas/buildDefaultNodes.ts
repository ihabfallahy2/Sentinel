import type { Project } from '@sentinel/shared-types'
import type { Edge, Node } from '@xyflow/react'

export function buildDefaultNodes(project: Project): { nodes: Node[]; edges: Edge[] } {
  const pid = project.id
  return {
    nodes: [
      {
        id: `project-${pid}`,
        type: 'project_node',
        position: { x: 40, y: 40 },
        data: { projectId: pid },
      },
      {
        id: `log-${pid}`,
        type: 'log_stream',
        position: { x: 400, y: 40 },
        data: { projectId: pid },
      },
      {
        id: `docker-${pid}`,
        type: 'docker_control',
        position: { x: 40, y: 260 },
        data: { projectId: pid },
      },
      {
        id: `env-${pid}`,
        type: 'env_editor',
        position: { x: 400, y: 320 },
        data: { projectId: pid },
      },
      {
        id: `script-${pid}`,
        type: 'script_runner',
        position: { x: 40, y: 480 },
        data: { projectId: pid },
      },
      {
        id: `rest-${pid}`,
        type: 'rest_explorer',
        position: { x: 760, y: 40 },
        data: { projectId: pid },
      },
      {
        id: `action-${pid}`,
        type: 'action_button',
        position: { x: 760, y: 220 },
        data: {
          projectId: pid,
          url: 'https://httpbin.org/get',
          method: 'GET',
        },
      },
      {
        id: `jobs-${pid}`,
        type: 'job_monitor',
        position: { x: 760, y: 400 },
        data: { projectId: pid },
      },
      {
        id: `metric-${pid}`,
        type: 'metric_card',
        position: { x: 1120, y: 40 },
        data: { projectId: pid },
      },
      {
        id: `wf-${pid}`,
        type: 'workflow',
        position: { x: 1120, y: 260 },
        data: { projectId: pid },
      },
      {
        id: `sys-${pid}`,
        type: 'system_stats',
        position: { x: 1120, y: 520 },
        data: {},
      },
    ],
    edges: [
      {
        id: `e-${pid}-dl`,
        source: `project-${pid}`,
        target: `log-${pid}`,
        animated: true,
      },
    ],
  }
}
