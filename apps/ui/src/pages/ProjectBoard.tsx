import type { CanvasLayout } from '@sentinel/shared-types'
import { useQuery } from '@tanstack/react-query'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import { useCallback, useEffect, useRef } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { fetchCanvas, fetchProject, saveCanvas } from '../api/sentinelClient'
import { buildDefaultNodes } from '../canvas/buildDefaultNodes'
import { nodeTypes } from '../canvas/nodeTypes'

function ProjectCanvas({ projectId }: { projectId: string }) {
  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  })

  const { data: layout, isFetched: layoutFetched } = useQuery({
    queryKey: ['canvas', projectId],
    queryFn: () => fetchCanvas(projectId),
    enabled: !!projectId,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const initialized = useRef(false)
  const skipNextSave = useRef(true)

  useEffect(() => {
    initialized.current = false
    skipNextSave.current = true
  }, [projectId])

  useEffect(() => {
    if (!project || !layoutFetched || initialized.current) {
      return
    }
    initialized.current = true
    const hasLayout = layout && layout.nodes && layout.nodes.length > 0
    if (hasLayout) {
      setNodes(layout.nodes as Node[])
      setEdges((layout.edges as Edge[]) ?? [])
    } else {
      const d = buildDefaultNodes(project)
      setNodes(d.nodes)
      setEdges(d.edges)
    }
    skipNextSave.current = true
    const t = setTimeout(() => {
      skipNextSave.current = false
    }, 500)
    return () => clearTimeout(t)
  }, [project, layout, layoutFetched, setNodes, setEdges])

  useEffect(() => {
    if (!initialized.current || skipNextSave.current) {
      return
    }
    const h = setTimeout(() => {
      const payload: CanvasLayout = {
        nodes: nodes as unknown as CanvasLayout['nodes'],
        edges: edges as unknown as CanvasLayout['edges'],
      }
      saveCanvas(projectId, payload).catch(() => toast.error('No se pudo guardar el canvas'))
    }, 1200)
    return () => clearTimeout(h)
  }, [nodes, edges, projectId])

  const exportLayout = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sentinel-canvas-${projectId}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Layout exportado')
  }, [nodes, edges, projectId])

  const importLayout = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as {
            nodes: Node[]
            edges: Edge[]
          }
          if (parsed.nodes) {
            setNodes(parsed.nodes)
          }
          if (parsed.edges) {
            setEdges(parsed.edges)
          }
          toast.success('Layout importado (guardará en breve)')
        } catch {
          toast.error('JSON inválido')
        }
      }
      reader.readAsText(file)
    },
    [setEdges, setNodes],
  )

  if (loadingProject || !project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Cargando proyecto…
      </div>
    )
  }

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link className="text-sm text-violet-400 hover:underline" to="/">
            ← Proyectos
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-xs text-zinc-500">{project.githubUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-900"
            onClick={exportLayout}
          >
            Exportar canvas
          </button>
          <label className="cursor-pointer rounded border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-900">
            Importar
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  importLayout(f)
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </header>

      <div className="h-[calc(100vh-120px)] w-full rounded-lg border border-zinc-800 bg-zinc-900/40">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        >
          <Background gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </>
  )
}

export function ProjectBoard() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100">
      <ReactFlowProvider>
        <ProjectCanvas projectId={projectId} />
      </ReactFlowProvider>
    </div>
  )
}
