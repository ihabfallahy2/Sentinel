import type { CanvasLayout } from '@sentinel/shared-types'
import { useQuery } from '@tanstack/react-query'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeMouseHandler,
  type Node,
  type PaneMouseHandler,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { fetchCanvas, fetchProject, saveCanvas } from '../api/sentinelClient'
import { buildDefaultNodes } from '../canvas/buildDefaultNodes'
import { nodeTypes } from '../canvas/nodeTypes'
import { ContextMenu, type ContextMenuAction } from '../components/ContextMenu'
import { ProjectPanel, type ProjectPanelTab } from '../components/ProjectPanel'

type ContextMenuState =
  | { type: 'pane'; x: number; y: number }
  | { type: 'node'; x: number; y: number; nodeId: string }
  | null

function ProjectCanvas({ projectId }: { projectId: string }) {
  const flow = useReactFlow()
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activePanelTab, setActivePanelTab] = useState<ProjectPanelTab>('deployments')
  const initialized = useRef(false)
  const skipNextSave = useRef(true)
  const importInputRef = useRef<HTMLInputElement>(null)

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

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [])

  const onPaneContextMenu = useCallback<PaneMouseHandler>(
    (event) => {
      event.preventDefault()
      setContextMenu({ type: 'pane', x: event.clientX, y: event.clientY })
    },
    [setContextMenu],
  )

  const onNodeContextMenu = useCallback<NodeMouseHandler<Node>>(
    (event, node) => {
      event.preventDefault()
      setContextMenu({
        type: 'node',
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      })
    },
    [setContextMenu],
  )

  const contextMenuActions = useMemo<ContextMenuAction[]>(() => {
    if (!contextMenu) {
      return []
    }
    if (contextMenu.type === 'pane') {
      return [
        {
          id: 'import-repository',
          label: '+ Importar repositorio (proximamente)',
          onSelect: () => toast.message('Este flujo se implementa en la siguiente iteracion'),
        },
        {
          id: 'add-widget',
          label: '+ Anadir widget (proximamente)',
          onSelect: () => toast.message('Los shortcuts de widgets llegan en el siguiente PR'),
        },
        {
          id: 'fit-view',
          label: 'Ajustar vista',
          onSelect: () => flow.fitView({ duration: 250 }),
        },
        {
          id: 'export-canvas',
          label: 'Exportar canvas',
          onSelect: exportLayout,
        },
        {
          id: 'import-canvas',
          label: 'Importar canvas',
          onSelect: () => importInputRef.current?.click(),
        },
      ]
    }

    return [
      {
        id: 'open-deployments',
        label: 'Ver deployments',
        onSelect: () => {
          setActivePanelTab('deployments')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-variables',
        label: 'Ver variables',
        onSelect: () => {
          setActivePanelTab('variables')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-metrics',
        label: 'Ver metricas',
        onSelect: () => {
          setActivePanelTab('metrics')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-settings',
        label: 'Abrir configuracion',
        onSelect: () => {
          setActivePanelTab('settings')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'duplicate-node',
        label: 'Duplicar tarjeta',
        onSelect: () => {
          setNodes((current) => {
            const source = current.find((node) => node.id === contextMenu.nodeId)
            if (!source) {
              return current
            }
            const duplicate: Node = {
              ...source,
              id: crypto.randomUUID(),
              position: { x: source.position.x + 40, y: source.position.y + 40 },
              selected: false,
            }
            return [...current, duplicate]
          })
        },
      },
      {
        id: 'delete-node',
        label: 'Eliminar del canvas',
        danger: true,
        onSelect: () => {
          setNodes((current) => current.filter((node) => node.id !== contextMenu.nodeId))
          setEdges((current) =>
            current.filter(
              (edge) => edge.source !== contextMenu.nodeId && edge.target !== contextMenu.nodeId,
            ),
          )
        },
      },
    ]
  }, [contextMenu, exportLayout, flow, setEdges, setNodes])

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
            className="rounded border border-violet-700 px-3 py-1 text-xs text-violet-200 hover:bg-violet-950/40"
            onClick={() => {
              setActivePanelTab('deployments')
              setIsPanelOpen(true)
            }}
          >
            Abrir panel
          </button>
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
              ref={importInputRef}
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
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          fitView
        >
          <Background gap={20} size={1} variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap />
        </ReactFlow>
        {contextMenu ? (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={contextMenuActions}
            onClose={closeContextMenu}
          />
        ) : null}
        <ProjectPanel
          project={project}
          open={isPanelOpen}
          activeTab={activePanelTab}
          onChangeTab={setActivePanelTab}
          onClose={() => setIsPanelOpen(false)}
        />
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
