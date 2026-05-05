import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { fetchProjects } from './api/sentinelClient'
import { CanvasBoard } from './canvas/CanvasBoard'

export default function App() {
  const [projects, setProjects] = useState<unknown[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetchProjects()
        if (!cancelled) {
          setProjects(list)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar proyectos')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Sentinel</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Plataforma self-hosted para despliegue y operaciones en homelab (UI + API).
        </p>
      </header>

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm">
        <p className="font-medium text-zinc-300">Estado API — GET /api/projects</p>
        {error ? (
          <p className="mt-2 text-amber-400">{error}</p>
        ) : projects === null ? (
          <p className="mt-2 text-zinc-500">Cargando…</p>
        ) : (
          <p className="mt-2 text-zinc-400">
            {projects.length} proyecto(s). La lista vacía es esperada en el MVP inicial.
          </p>
        )}
      </section>

      <ReactFlowProvider>
        <CanvasBoard />
      </ReactFlowProvider>
    </div>
  )
}
