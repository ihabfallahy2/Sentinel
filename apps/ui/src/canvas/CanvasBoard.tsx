import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import { useMemo } from 'react'
import { DeployCardNode } from './nodes/DeployCardNode'
import { LogStreamNode } from './nodes/LogStreamNode'
import { useCanvasStore } from '../store/canvasStore'

const nodeTypes = {
  deploy_card: DeployCardNode,
  log_stream: LogStreamNode,
}

export function CanvasBoard() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore()
  const types = useMemo(() => nodeTypes, [])

  return (
    <div className="h-[70vh] w-full rounded-lg border border-zinc-800 bg-zinc-900/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={types}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background gap={20} size={1} variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
