import type { Project } from '@sentinel/shared-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  deployProject,
  dockerAction,
  fetchDeployments,
  fetchEnv,
  fetchEnvDiff,
  fetchSystemStats,
  rollbackProject,
  runScript,
  saveEnv,
} from '../api/sentinelClient'

export type ProjectPanelTab = 'deployments' | 'variables' | 'metrics' | 'settings'

const tabs: Array<{ id: ProjectPanelTab; label: string }> = [
  { id: 'deployments', label: 'Deployments' },
  { id: 'variables', label: 'Variables' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'settings', label: 'Settings' },
]

type ProjectPanelProps = {
  project: Project
  open: boolean
  activeTab: ProjectPanelTab
  onChangeTab: (tab: ProjectPanelTab) => void
  onClose: () => void
}

export function ProjectPanel({ project, open, activeTab, onChangeTab, onClose }: ProjectPanelProps) {
  const qc = useQueryClient()
  const [envDraft, setEnvDraft] = useState<string | null>(null)
  const [scriptPath, setScriptPath] = useState('scripts/deploy.sh')
  const [scriptOutput, setScriptOutput] = useState<string | null>(null)
  const [expandedDeploymentId, setExpandedDeploymentId] = useState<string | null>(null)

  const { data: deployments = [], isLoading: loadingDeployments } = useQuery({
    queryKey: ['deployments', project.id],
    queryFn: () => fetchDeployments(project.id),
    enabled: open && activeTab === 'deployments',
    staleTime: 15_000,
  })

  const { data: envData } = useQuery({
    queryKey: ['project-env', project.id],
    queryFn: () => fetchEnv(project.id),
    enabled: open && activeTab === 'variables',
  })

  const { data: envDiff } = useQuery({
    queryKey: ['project-env-diff', project.id],
    queryFn: () => fetchEnvDiff(project.id),
    enabled: open && activeTab === 'variables',
  })

  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: fetchSystemStats,
    enabled: open && activeTab === 'metrics',
    refetchInterval: 10_000,
  })

  const deployMutation = useMutation({
    mutationFn: (pull: boolean) => deployProject(project.id, { pull }),
    onSuccess: () => {
      toast.success('Deploy lanzado')
      void qc.invalidateQueries({ queryKey: ['project', project.id] })
      void qc.invalidateQueries({ queryKey: ['deployments', project.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const stopMutation = useMutation({
    mutationFn: () => dockerAction(project.id, 'stop'),
    onSuccess: () => {
      toast.success('Servicios detenidos')
      void qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const rollbackMutation = useMutation({
    mutationFn: (deploymentId: string) => rollbackProject(project.id, deploymentId),
    onSuccess: () => {
      toast.success('Rollback ejecutado')
      void qc.invalidateQueries({ queryKey: ['project', project.id] })
      void qc.invalidateQueries({ queryKey: ['deployments', project.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const saveEnvMutation = useMutation({
    mutationFn: (content: string) => saveEnv(project.id, content),
    onSuccess: () => {
      toast.success('.env guardado')
      void qc.invalidateQueries({ queryKey: ['project-env', project.id] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const restartMutation = useMutation({
    mutationFn: () => dockerAction(project.id, 'restart'),
    onSuccess: () => toast.success('Servicios reiniciados'),
    onError: (error: Error) => toast.error(error.message),
  })

  const rebuildMutation = useMutation({
    mutationFn: () => dockerAction(project.id, 'rebuild'),
    onSuccess: () => toast.success('Rebuild lanzado'),
    onError: (error: Error) => toast.error(error.message),
  })

  const runScriptMutation = useMutation({
    mutationFn: (path: string) => runScript(project.id, path),
    onSuccess: (result) => {
      const output = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n')
      setScriptOutput(output.length > 0 ? output : '(sin output)')
      toast.success(result.ok ? 'Script ejecutado' : `Script finalizo con codigo ${result.code}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const latestSuccessfulDeployment = useMemo(
    () => deployments.find((item) => item.status === 'success' || item.status === 'rolled_back'),
    [deployments],
  )

  useEffect(() => {
    setEnvDraft(null)
    setExpandedDeploymentId(null)
  }, [project.id, activeTab])

  const envContent = envDraft ?? envData?.content ?? ''
  const envDiffSummary = useMemo(() => {
    if (!envDiff) {
      return []
    }
    return computeMissingEnvKeys(envDiff.example, envDiff.env)
  }, [envDiff])

  return (
    <aside
      className={
        open
          ? 'pointer-events-auto fixed inset-y-4 right-4 z-40 flex w-[420px] max-w-[92vw] flex-col rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl transition-all duration-150'
          : 'pointer-events-none fixed inset-y-4 right-0 z-40 flex w-[420px] max-w-[92vw] translate-x-[105%] flex-col rounded-xl border border-zinc-700 bg-zinc-900/95 opacity-0 shadow-2xl transition-all duration-150'
      }
      aria-hidden={!open}
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm text-zinc-500">Proyecto</p>
          <h2 className="text-base font-semibold text-zinc-100">{project.name}</h2>
        </div>
        <button
          type="button"
          className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
          onClick={onClose}
        >
          Cerrar
        </button>
      </header>

      <div className="flex gap-1 border-b border-zinc-800 px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={
              activeTab === tab.id
                ? 'rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white'
                : 'rounded px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800'
            }
            onClick={() => onChangeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 text-sm text-zinc-300">
        {activeTab === 'deployments' ? (
          <div className="space-y-3">
            <p className="text-zinc-400">Estado actual: {project.status}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deployMutation.isPending}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={() => deployMutation.mutate(false)}
              >
                Deploy
              </button>
              <button
                type="button"
                disabled={deployMutation.isPending}
                className="rounded bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600 disabled:opacity-50"
                onClick={() => deployMutation.mutate(true)}
              >
                Pull + deploy
              </button>
              <button
                type="button"
                disabled={stopMutation.isPending}
                className="rounded bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                onClick={() => stopMutation.mutate()}
              >
                Stop
              </button>
            </div>
            {latestSuccessfulDeployment ? (
              <button
                type="button"
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                disabled={rollbackMutation.isPending}
                onClick={() => rollbackMutation.mutate(latestSuccessfulDeployment.id)}
              >
                Rollback a {latestSuccessfulDeployment.commitSha.slice(0, 7)}
              </button>
            ) : null}

            {loadingDeployments ? <p className="text-xs text-zinc-500">Cargando deployments...</p> : null}
            <ul className="space-y-2 text-xs">
              {deployments.slice(0, 8).map((dep) => (
                <li key={dep.id} className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-200">
                        {dep.status.toUpperCase()} · {dep.commitSha.slice(0, 7)}
                      </p>
                      <p className="text-zinc-500">{dep.commitMessage || 'Sin mensaje de commit'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {(dep.status === 'success' || dep.status === 'rolled_back') && (
                        <button
                          type="button"
                          className="rounded border border-zinc-700 px-2 py-1 text-[11px] hover:bg-zinc-800"
                          disabled={rollbackMutation.isPending}
                          onClick={() => rollbackMutation.mutate(dep.id)}
                        >
                          Rollback
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded border border-zinc-700 px-2 py-1 text-[11px] hover:bg-zinc-800"
                        onClick={() =>
                          setExpandedDeploymentId((current) => (current === dep.id ? null : dep.id))
                        }
                      >
                        {expandedDeploymentId === dep.id ? 'Ocultar logs' : 'Ver logs'}
                      </button>
                    </div>
                  </div>
                  {expandedDeploymentId === dep.id ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[11px] text-zinc-300">
                      {dep.logs?.length ? dep.logs.join('\n') : '(sin logs)'}
                    </pre>
                  ) : null}
                </li>
              ))}
              {deployments.length === 0 ? (
                <li className="text-zinc-500">No hay deployments registrados.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {activeTab === 'variables' ? (
          <div className="space-y-3">
            <p>Gestion de variables de entorno del proyecto.</p>
            <textarea
              className="min-h-40 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-200"
              placeholder="Contenido de .env"
              value={envContent}
              onChange={(event) => setEnvDraft(event.target.value)}
            />
            <button
              type="button"
              className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
              disabled={saveEnvMutation.isPending}
              onClick={() => saveEnvMutation.mutate(envContent)}
            >
              Guardar .env
            </button>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 p-2 text-xs">
              <p className="mb-1 text-zinc-400">Diff con .env.example</p>
              {envDiffSummary.length > 0 ? (
                <ul className="list-disc pl-4 text-amber-300">
                  {envDiffSummary.map((key) => (
                    <li key={key}>{key}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-zinc-500">Sin variables faltantes detectadas.</p>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'metrics' ? (
          <div className="space-y-3">
            <p>Vista de metricas del host y endpoints custom.</p>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 p-3 text-xs">
              <p>CPU load: {formatMetricValue((stats as { cpu?: { load?: number } } | undefined)?.cpu?.load, '%')}</p>
              <p>
                RAM usada:{' '}
                {formatBytes((stats as { mem?: { used?: number } } | undefined)?.mem?.used)} /{' '}
                {formatBytes((stats as { mem?: { total?: number } } | undefined)?.mem?.total)}
              </p>
              <p>
                Disco usado:{' '}
                {formatBytes((stats as { disk?: { used?: number } } | undefined)?.disk?.used)} /{' '}
                {formatBytes((stats as { disk?: { size?: number } } | undefined)?.disk?.size)}
              </p>
            </div>
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="space-y-3">
            <p>Repo: {project.githubUrl}</p>
            <p>Rama: {project.branch}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-50"
                disabled={restartMutation.isPending}
                onClick={() => restartMutation.mutate()}
              >
                Docker restart
              </button>
              <button
                type="button"
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 disabled:opacity-50"
                disabled={rebuildMutation.isPending}
                onClick={() => rebuildMutation.mutate()}
              >
                Docker rebuild
              </button>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="mb-2 text-xs text-zinc-400">Scripts</p>
              <div className="flex gap-2">
                <input
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                  value={scriptPath}
                  onChange={(event) => setScriptPath(event.target.value)}
                  placeholder="scripts/deploy.sh"
                />
                <button
                  type="button"
                  className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                  disabled={runScriptMutation.isPending || scriptPath.trim().length === 0}
                  onClick={() => runScriptMutation.mutate(scriptPath.trim())}
                >
                  Run
                </button>
              </div>
              {scriptOutput ? (
                <pre className="mt-2 max-h-36 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-[11px] text-zinc-300">
                  {scriptOutput}
                </pre>
              ) : null}
            </div>
            <div className="rounded border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">
              Zona Danger: eliminar proyecto y acciones avanzadas en siguiente iteracion.
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function computeMissingEnvKeys(exampleContent?: string, envContent?: string): string[] {
  const exampleKeys = extractEnvKeys(exampleContent)
  const envKeys = new Set(extractEnvKeys(envContent))
  return exampleKeys.filter((key) => !envKeys.has(key))
}

function extractEnvKeys(content?: string): string[] {
  if (!content) return []
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
    .map((line) => line.split('=')[0].trim())
}

function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) {
    return 'n/a'
  }
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

function formatMetricValue(value?: number, suffix = ''): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'n/a'
  }
  return `${value.toFixed(1)}${suffix}`
}
