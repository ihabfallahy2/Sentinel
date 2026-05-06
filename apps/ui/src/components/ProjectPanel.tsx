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
  const [envMode, setEnvMode] = useState<'table' | 'raw'>('table')
  const [settingsSection, setSettingsSection] = useState<
    'source' | 'build' | 'deploy' | 'networking' | 'config' | 'flags' | 'danger'
  >('source')
  const [scriptPath, setScriptPath] = useState('scripts/deploy.sh')
  const [scriptOutput, setScriptOutput] = useState<string | null>(null)
  const [expandedDeploymentId, setExpandedDeploymentId] = useState<string | null>(null)
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')

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
    setNewVarKey('')
    setNewVarValue('')
    setSettingsSection('source')
  }, [project.id, activeTab])

  const envContent = envDraft ?? envData?.content ?? ''
  const envEntries = useMemo(() => parseEnv(envContent), [envContent])
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Deployments</p>
                <p className="text-xs text-zinc-500">Estado actual: {project.status}</p>
              </div>
            </div>
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

            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Latest</p>
              {deployments[0] ? (
                <div className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-zinc-200">
                      {deployments[0].status.toUpperCase()} · {deployments[0].commitSha.slice(0, 7)}
                    </p>
                    <span className="text-zinc-500">
                      {new Date(deployments[0].createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zinc-500">{deployments[0].commitMessage || 'Sin mensaje de commit'}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['init', 'build', 'deploy'].map((step) => (
                      <div
                        key={step}
                        className="rounded border border-zinc-800 bg-black/30 px-2 py-1 text-[11px] text-zinc-400"
                      >
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Aún no hay deployments.</p>
              )}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-100">Variables</p>
                <p className="text-xs text-zinc-500">KEY · VALUE (mask) · acciones</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                  onClick={() => setEnvMode((m) => (m === 'table' ? 'raw' : 'table'))}
                >
                  {envMode === 'table' ? 'Raw editor' : 'Tabla'}
                </button>
                <button
                  type="button"
                  className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 disabled:opacity-50"
                  disabled={saveEnvMutation.isPending}
                  onClick={() => saveEnvMutation.mutate(envContent)}
                >
                  Guardar
                </button>
              </div>
            </div>

            {envMode === 'raw' ? (
              <textarea
                className="min-h-40 w-full rounded border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-200"
                placeholder="Contenido de .env"
                value={envContent}
                onChange={(event) => setEnvDraft(event.target.value)}
              />
            ) : (
              <div className="space-y-2">
                <div className="rounded border border-zinc-800 bg-zinc-950/70 p-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                      placeholder="KEY"
                      value={newVarKey}
                      onChange={(e) => setNewVarKey(e.target.value)}
                    />
                    <input
                      className="flex-[2] rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
                      placeholder="VALUE"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                    />
                    <button
                      type="button"
                      className="rounded bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600 disabled:opacity-50"
                      disabled={newVarKey.trim().length === 0}
                      onClick={() => {
                        const key = newVarKey.trim()
                        const value = newVarValue
                        const next = upsertEnvEntry(envEntries, { key, value })
                        setEnvDraft(stringifyEnv(next))
                        setNewVarKey('')
                        setNewVarValue('')
                      }}
                    >
                      + New Variable
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded border border-zinc-800">
                  <div className="grid grid-cols-[1fr,1fr,120px] gap-0 border-b border-zinc-800 bg-zinc-950/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    <div>Key</div>
                    <div>Value</div>
                    <div className="text-right">Actions</div>
                  </div>
                  <div className="divide-y divide-zinc-800 bg-zinc-950/40">
                    {envEntries.map((entry) => (
                      <div
                        key={entry.key}
                        className="grid grid-cols-[1fr,1fr,120px] items-center gap-2 px-3 py-2 text-xs"
                      >
                        <div className="font-mono text-zinc-200">{entry.key}</div>
                        <div className="min-w-0">
                          <input
                            className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
                            value={entry.value}
                            onChange={(e) => {
                              const next = upsertEnvEntry(envEntries, {
                                key: entry.key,
                                value: e.target.value,
                              })
                              setEnvDraft(stringifyEnv(next))
                            }}
                          />
                          <div className="mt-1 truncate text-[11px] text-zinc-500">
                            Mask: {maskValue(entry.value)}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-800"
                            onClick={() => {
                              const next = envEntries.filter((e) => e.key !== entry.key)
                              setEnvDraft(stringifyEnv(next))
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {envEntries.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-zinc-500">Aún no hay variables.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Metrics</p>
                <p className="text-xs text-zinc-500">Host CPU/RAM/Disk (placeholder de histórico).</p>
              </div>
              <div className="flex gap-1">
                {['1h', '6h', '1d', '7d'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-500 disabled:opacity-60"
                    title="Histórico no disponible aún"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">CPU load</p>
                <p className="mt-1 text-lg font-semibold text-zinc-100">
                  {formatMetricValue((stats as { cpu?: { load?: number } } | undefined)?.cpu?.load, '%')}
                </p>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">RAM</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {formatBytes((stats as { mem?: { used?: number } } | undefined)?.mem?.used)}{' '}
                  <span className="text-zinc-500">/</span>{' '}
                  {formatBytes((stats as { mem?: { total?: number } } | undefined)?.mem?.total)}
                </p>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Disk</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">
                  {formatBytes((stats as { disk?: { used?: number } } | undefined)?.disk?.used)}{' '}
                  <span className="text-zinc-500">/</span>{' '}
                  {formatBytes((stats as { disk?: { size?: number } } | undefined)?.disk?.size)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'settings' ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Settings</p>
              <p className="mt-1 text-xs text-zinc-500">Subnavegación interna estilo Railway.</p>
            </div>
            <div className="flex gap-3">
              <nav className="w-[140px] shrink-0 space-y-1">
                {[
                  { id: 'source', label: 'Source' },
                  { id: 'build', label: 'Build' },
                  { id: 'deploy', label: 'Deploy' },
                  { id: 'networking', label: 'Networking' },
                  { id: 'config', label: 'Config-as-code' },
                  { id: 'flags', label: 'Feature flags' },
                  { id: 'danger', label: 'Danger' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      settingsSection === (item.id as typeof settingsSection)
                        ? 'w-full rounded bg-zinc-800 px-2 py-1.5 text-left text-xs text-zinc-100'
                        : 'w-full rounded px-2 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800'
                    }
                    onClick={() => setSettingsSection(item.id as typeof settingsSection)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="min-w-0 flex-1">
                {settingsSection === 'source' ? (
                  <div className="space-y-3">
                    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Repo</p>
                      <p className="mt-1 break-all text-xs text-zinc-200">{project.githubUrl}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Branch <span className="text-zinc-200">{project.branch}</span>
                      </p>
                    </div>
                    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                      Toggles (placeholders): auto-deploy, wait for CI, disconnect.
                    </div>
                  </div>
                ) : null}

                {settingsSection === 'build' ? (
                  <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                    Build settings (placeholder): build command, artifacts, cache.
                  </div>
                ) : null}

                {settingsSection === 'deploy' ? (
                  <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                    Deploy settings (placeholder): region, rollout, healthchecks.
                  </div>
                ) : null}

                {settingsSection === 'networking' ? (
                  <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                    Networking (placeholder): domains, ports, TLS.
                  </div>
                ) : null}

                {settingsSection === 'config' ? (
                  <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                    Config-as-code (placeholder): sentinel.yml / compose overrides.
                  </div>
                ) : null}

                {settingsSection === 'flags' ? (
                  <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                    Feature flags (placeholder).
                  </div>
                ) : null}

                {settingsSection === 'danger' ? (
                  <div className="space-y-3">
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
                      Danger zone (placeholder): eliminar proyecto y acciones avanzadas.
                    </div>
                  </div>
                ) : null}
              </div>
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

type EnvEntry = { key: string; value: string }

function parseEnv(content: string): EnvEntry[] {
  const out: EnvEntry[] = []
  const seen = new Set<string>()
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ key, value })
  }
  out.sort((a, b) => a.key.localeCompare(b.key))
  return out
}

function stringifyEnv(entries: EnvEntry[]): string {
  return entries
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((e) => `${e.key}=${e.value}`)
    .join('\n')
}

function upsertEnvEntry(entries: EnvEntry[], entry: EnvEntry): EnvEntry[] {
  const next = entries.slice()
  const idx = next.findIndex((e) => e.key === entry.key)
  if (idx >= 0) {
    next[idx] = entry
    return next
  }
  next.push(entry)
  return next
}

function maskValue(value: string): string {
  if (value.length === 0) return '(empty)'
  if (value.length <= 2) return '••'
  return `${value.slice(0, 1)}••••${value.slice(-1)}`
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
