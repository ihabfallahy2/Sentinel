import type { CanvasLayout, Project } from '@sentinel/shared-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import {
  fetchBoard,
  fetchBoardCanvas,
  importBoardProject,
  removeBoardProject,
  saveBoardCanvas,
} from '../api/sentinelClient'
import { nodeTypes } from '../canvas/nodeTypes'
import { ContextMenu, type ContextMenuAction } from '../components/ContextMenu'
import { ProjectPanel, type ProjectPanelTab } from '../components/ProjectPanel'

type ContextMenuState =
  | { type: 'pane'; x: number; y: number }
  | { type: 'node'; x: number; y: number; nodeId: string }
  | null

function ProjectCanvas({ boardId }: { boardId: string }) {
  const qc = useQueryClient()
  const flow = useReactFlow()
  const { data: board, isLoading: loadingBoard } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => fetchBoard(boardId),
  })

  const { data: layout, isFetched: layoutFetched } = useQuery({
    queryKey: ['board-canvas', boardId],
    queryFn: () => fetchBoardCanvas(boardId),
    enabled: !!boardId,
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [showImportPanel, setShowImportPanel] = useState(false)
  const [githubUrl, setGithubUrl] = useState('https://github.com/octocat/Hello-World')
  const [branch, setBranch] = useState('main')
  const [displayName, setDisplayName] = useState('')
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activePanelTab, setActivePanelTab] = useState<ProjectPanelTab>('deployments')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const initialized = useRef(false)
  const skipNextSave = useRef(true)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initialized.current = false
    skipNextSave.current = true
  }, [boardId])

  const importProjectMutation = useMutation({
    mutationFn: () =>
      importBoardProject(boardId, {
        githubUrl: githubUrl.trim(),
        branch: branch.trim() || 'main',
        name: displayName.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success('Repositorio importado en la pizarra')
      await qc.invalidateQueries({ queryKey: ['board', boardId] })
      setShowImportPanel(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  useEffect(() => {
    if (!board || !layoutFetched || initialized.current) {
      return
    }
    initialized.current = true
    const hasLayout = layout && layout.nodes && layout.nodes.length > 0
    if (hasLayout) {
      setNodes(layout.nodes as Node[])
      setEdges((layout.edges as Edge[]) ?? [])
    } else {
      const d = buildBoardDefaultNodes(board.projects)
      setNodes(d.nodes)
      setEdges(d.edges)
    }
    skipNextSave.current = true
    const t = setTimeout(() => {
      skipNextSave.current = false
    }, 500)
    return () => clearTimeout(t)
  }, [board, layout, layoutFetched, setNodes, setEdges])

  useEffect(() => {
    if (!initialized.current || skipNextSave.current) {
      return
    }
    const h = setTimeout(() => {
      const payload: CanvasLayout = {
        nodes: nodes as unknown as CanvasLayout['nodes'],
        edges: edges as unknown as CanvasLayout['edges'],
      }
      saveBoardCanvas(boardId, payload).catch(() => toast.error('No se pudo guardar el canvas'))
    }, 1200)
    return () => clearTimeout(h)
  }, [nodes, edges, boardId])

  const exportLayout = useCallback(() => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sentinel-board-${boardId}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Layout exportado')
  }, [nodes, edges, boardId])

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

  const selectedProject = useMemo(
    () => board?.projects.find((project) => project.id === selectedProjectId) ?? null,
    [board?.projects, selectedProjectId],
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
          label: '+ Importar repositorio',
          onSelect: () => setShowImportPanel(true),
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
            const projectId = getProjectIdFromNode(nodes, contextMenu.nodeId)
            if (!projectId) return
            setSelectedProjectId(projectId)
          setActivePanelTab('deployments')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-variables',
        label: 'Ver variables',
        onSelect: () => {
            const projectId = getProjectIdFromNode(nodes, contextMenu.nodeId)
            if (!projectId) return
            setSelectedProjectId(projectId)
          setActivePanelTab('variables')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-metrics',
        label: 'Ver metricas',
        onSelect: () => {
            const projectId = getProjectIdFromNode(nodes, contextMenu.nodeId)
            if (!projectId) return
            setSelectedProjectId(projectId)
          setActivePanelTab('metrics')
          setIsPanelOpen(true)
        },
      },
      {
        id: 'open-settings',
        label: 'Abrir configuracion',
        onSelect: () => {
            const projectId = getProjectIdFromNode(nodes, contextMenu.nodeId)
            if (!projectId) return
            setSelectedProjectId(projectId)
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
          const projectId = getProjectIdFromNode(nodes, contextMenu.nodeId)
          if (projectId && boardId) {
            void removeBoardProject(boardId, projectId)
              .then(() => qc.invalidateQueries({ queryKey: ['board', boardId] }))
              .catch((error: Error) => toast.error(error.message))
          }
          setNodes((current) => current.filter((node) => node.id !== contextMenu.nodeId))
          setEdges((current) =>
            current.filter(
              (edge) => edge.source !== contextMenu.nodeId && edge.target !== contextMenu.nodeId,
            ),
          )
        },
      },
    ]
  }, [boardId, contextMenu, exportLayout, flow, nodes, qc, setEdges, setNodes])

  if (loadingBoard || !board) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Cargando pizarra…
      </div>
    )
  }

  return (
    <>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link className="text-sm text-violet-400 hover:underline" to="/">
            ← Pizarras
          </Link>
          <h1 className="text-xl font-semibold">{board.name}</h1>
          <p className="text-xs text-zinc-500">{board.projects.length} proyectos conectados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-violet-700 px-3 py-1 text-xs text-violet-200 hover:bg-violet-950/40"
            onClick={() => {
              if (board.projects.length === 0) {
                toast.error('Importa un repositorio primero')
                return
              }
              setSelectedProjectId(board.projects[0].id)
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
        {selectedProject ? (
          <ProjectPanel
            project={selectedProject}
            open={isPanelOpen}
            activeTab={activePanelTab}
            onChangeTab={setActivePanelTab}
            onClose={() => setIsPanelOpen(false)}
          />
        ) : null}
        {showImportPanel ? (
          <div className="fixed inset-y-4 right-4 z-40 flex w-[420px] max-w-[92vw] flex-col rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Importar repositorio</h2>
              <button
                type="button"
                className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                onClick={() => setShowImportPanel(false)}
              >
                Cerrar
              </button>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                importProjectMutation.mutate()
              }}
            >
              <label className="text-xs text-zinc-400">
                URL de GitHub
                <input
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  value={githubUrl}
                  onChange={(event) => setGithubUrl(event.target.value)}
                  required
                />
              </label>
              <label className="text-xs text-zinc-400">
                Rama
                <input
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                />
              </label>
              <label className="text-xs text-zinc-400">
                Nombre opcional
                <input
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={importProjectMutation.isPending}
                className="rounded bg-violet-600 py-2 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                {importProjectMutation.isPending ? 'Clonando...' : 'Clonar y anadir'}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </>
  )
}

export function ProjectBoard() {
  const { boardId } = useParams<{ boardId: string }>()
  if (!boardId) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 text-zinc-100">
      <ReactFlowProvider>
        <ProjectCanvas boardId={boardId} />
      </ReactFlowProvider>
    </div>
  )
}

function buildBoardDefaultNodes(projects: Project[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = projects.map((project, index) => ({
    id: `deploy-${project.id}`,
    type: 'deploy_card',
    position: { x: 80 + (index % 3) * 360, y: 80 + Math.floor(index / 3) * 240 },
    data: { projectId: project.id },
  }))
  nodes.push({
    id: 'system-stats',
    type: 'system_stats',
    position: { x: 80, y: 80 + Math.ceil(Math.max(projects.length, 1) / 3) * 240 },
    data: {},
  })
  return { nodes, edges: [] }
}

function getProjectIdFromNode(nodes: Node[], nodeId: string): string | null {
  const node = nodes.find((item) => item.id === nodeId)
  const projectId = (node?.data as { projectId?: string } | undefined)?.projectId
  return projectId ?? null
}
