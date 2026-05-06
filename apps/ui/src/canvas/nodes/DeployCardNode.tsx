import type { NodeProps } from '@xyflow/react'
import { ProjectNode, type ProjectNodeData } from './ProjectNode'

// Backwards-compatible alias for persisted layouts using `deploy_card`.
export type DeployCardData = ProjectNodeData

export function DeployCardNode(props: NodeProps<DeployCardData>) {
  return <ProjectNode {...props} />
}
