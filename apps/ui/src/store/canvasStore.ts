import type { Edge, Node, OnEdgesChange, OnNodesChange } from '@xyflow/react'
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react'
import { create } from 'zustand'

export type CanvasState = {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: (params: Parameters<typeof addEdge>[0]) => void
  replaceNodes: (nodes: Node[]) => void
  replaceEdges: (edges: Edge[]) => void
}

const welcomeNode: Node = {
  id: 'welcome',
  type: 'default',
  position: { x: 40, y: 40 },
  data: { label: 'Añade un repositorio Git para ver widgets de deploy y logs.' },
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [welcomeNode],
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
  replaceNodes: (nodes) => {
    set({ nodes })
  },
  replaceEdges: (edges) => {
    set({ edges })
  },
}))
