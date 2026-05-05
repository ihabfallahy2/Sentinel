import type { Edge, Node, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import { create } from 'zustand'

export type CanvasState = {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: (params: Parameters<typeof addEdge>[0]) => void
}

const initialNodes: Node[] = [
  {
    id: 'welcome',
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: 'Sentinel canvas (MVP)' },
  },
]

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    })
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    })
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    })
  },
}))
