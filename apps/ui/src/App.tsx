import type { Project } from '@sentinel/shared-types'
import type { Node } from '@xyflow/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import { createProject, fetchProjects } from './api/sentinelClient'
import { CanvasBoard } from './canvas/CanvasBoard'
import { useCanvasStore } from './store/canvasStore'

function buildNodes(projects: Project[], onDeployed: () => Promise<void>): Node[] {
  if (projects.length === 0) {
    return [
      {
        id: 'welcome',
        type: 'default',
        position: { x: 40, y: 40 },
        data: { label: 'Añade un repositorio Git para ver deploy y logs en vivo.' },
      },
    ]
  }
  const p = projects[0]
  return [
    {
      id: `deploy-${p.id}`,
      type: 'deploy_card',
      position: { x: 40, y: 40 },
      data: { project: p, onDeployed },
    },
    {
      id: `log-${p.id}`,
      type: 'log_stream',
      position: { x: 400, y: 40 },
      data: { projectId: p.id },
    },
  ]
}

export default function App() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [githubUrl, setGithubUrl] = useState('https://github.com/octocat/Hello-World')
  const [branch, setBranch] = useState('master')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const replaceNodes = useCanvasStore((s) => s.replaceNodes)

  const refresh = useCallback(async () => {
    const list = await fetchProjects()
    setProjects(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refresh()
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar proyectos')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    if (projects === null) {
      return
    }
    replaceNodes(buildNodes(projects, refresh))
  }, [projects, refresh, replaceNodes])

  return (
    <div className="min-h-screen p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Sentinel</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plataforma self-hosted para despliegue y operaciones en homelab (UI + API).
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <p className="font-medium text-zinc-300">Proyectos</p>
        {error ? (
          <p className="mt-2 text-amber-400">{error}</p>
        ) : projects === null ? (
          <p className="mt-2 text-zinc-500">Cargando…</p>
        ) : (
          <p className="mt-2 text-zinc-400">
            {projects.length} registro(s). El canvas muestra el primero (MVP).
          </p>
        )}

        <form
          className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            setCreating(true)
            try {
              await createProject({
                githubUrl: githubUrl.trim(),
                branch: branch.trim() || 'main',
                name: name.trim() || undefined,
              })
              await refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo crear el proyecto')
            } finally {
              setCreating(false)
            }
          }}
        >
          <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-zinc-500">
            URL GitHub
            <input
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={githubUrl}
              onChange={(ev) => setGithubUrl(ev.target.value)}
              required
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs text-zinc-500">
            Rama
            <input
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={branch}
              onChange={(ev) => setBranch(ev.target.value)}
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs text-zinc-500">
            Nombre (opcional)
            <input
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              placeholder="repo-slug"
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {creating ? 'Clonando…' : 'Añadir proyecto'}
          </button>
        </form>
      </section>

      <ReactFlowProvider>
        <CanvasBoard />
      </ReactFlowProvider>
    </div>
  )
}
