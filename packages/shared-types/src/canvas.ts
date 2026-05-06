/** Layout persistido (serialización compatible con React Flow). */
export interface CanvasLayout {
  nodes: Record<string, unknown>[]
  edges: Record<string, unknown>[]
}
