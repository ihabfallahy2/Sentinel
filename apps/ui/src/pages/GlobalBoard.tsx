import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  createProject,
  deleteProject,
  fetchGithubRepos,
  fetchProjects,
} from '../api/sentinelClient'

export function GlobalBoard() {
  const qc = useQueryClient()
  const [githubUrl, setGithubUrl] = useState('https://github.com/octocat/Hello-World')
  const [branch, setBranch] = useState('master')
  const [name, setName] = useState('')

  const { data: projects = [], error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const { data: ghRepos = [] } = useQuery({
    queryKey: ['github-repos'],
    queryFn: fetchGithubRepos,
    staleTime: 60_000,
  })

  const createM = useMutation({
    mutationFn: () =>
      createProject({
        githubUrl: githubUrl.trim(),
        branch: branch.trim() || 'main',
        name: name.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Proyecto añadido')
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      toast.success('Proyecto eliminado')
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sentinel</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pizarra global: proyectos desplegados en tu homelab. Abre uno para el canvas completo de
          widgets.
        </p>
      </header>

      {error ? (
        <p className="mb-4 text-amber-400">{(error as Error).message}</p>
      ) : null}

      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">Añadir proyecto (clone Git)</h2>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              createM.mutate()
            }}
          >
            <label className="text-xs text-zinc-500">
              URL GitHub
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                required
              />
            </label>
            <label className="text-xs text-zinc-500">
              Rama
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </label>
            <label className="text-xs text-zinc-500">
              Nombre (opcional)
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={createM.isPending}
              className="rounded-md bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {createM.isPending ? 'Clonando…' : 'Añadir proyecto'}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-medium text-zinc-300">
            Repos GitHub (token <code className="text-zinc-500">GITHUB_TOKEN</code> en API)
          </h2>
          {ghRepos.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-600">
              Sin token o sin repos. Configura la variable en el servidor de la API.
            </p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-xs">
              {ghRepos.slice(0, 40).map((r) => (
                <li key={r.fullName}>
                  <button
                    type="button"
                    className="text-left text-sky-400 hover:underline"
                    onClick={() => {
                      setGithubUrl(r.cloneUrl)
                      setBranch(r.defaultBranch)
                      setName(r.name)
                      toast.message('Relleno desde GitHub', { description: r.fullName })
                    }}
                  >
                    {r.fullName}
                  </button>
                  <span className="text-zinc-600"> · {r.defaultBranch}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Proyectos ({projects.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    className="text-lg font-medium text-white hover:text-violet-300"
                    to={`/p/${p.id}`}
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.githubUrl}</p>
                </div>
                <span
                  className={
                    p.status === 'online'
                      ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500'
                      : p.status === 'error'
                        ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-red-500'
                        : p.status === 'building'
                          ? 'h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400'
                          : 'h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-500'
                  }
                  title={p.status}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                Rama {p.branch}
                {p.lastDeployedAt
                  ? ` · ${new Date(p.lastDeployedAt).toLocaleString()}`
                  : ''}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  className="flex-1 rounded bg-zinc-800 py-1.5 text-center text-xs text-zinc-100 hover:bg-zinc-700"
                  to={`/p/${p.id}`}
                >
                  Abrir canvas
                </Link>
                <button
                  type="button"
                  disabled={deleteM.isPending}
                  className="rounded border border-red-900/60 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-40"
                  onClick={() => {
                    if (confirm(`¿Eliminar ${p.name}?`)) {
                      deleteM.mutate(p.id)
                    }
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
          {projects.length === 0 ? (
            <p className="text-sm text-zinc-600">Aún no hay proyectos.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
