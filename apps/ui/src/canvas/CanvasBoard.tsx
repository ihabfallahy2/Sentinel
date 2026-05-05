import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import { useCanvasStore } from '../store/canvasStore'

export function CanvasBoard() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useCanvasStore()

  return (
    <div className="h-[70vh] w-full rounded-lg border border-zinc-800 bg-zinc-900/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
