import type { Project } from '@sentinel/shared-types'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { deployProject } from '../../api/sentinelClient'

export type DeployCardData = {
  project: Project
  onDeployed: () => Promise<void>
}

export function DeployCardNode({ data }: NodeProps<DeployCardData>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { project, onDeployed } = data

  const statusColor =
    project.status === 'online'
      ? 'bg-emerald-500'
      : project.status === 'building'
        ? 'bg-amber-400 animate-pulse'
        : project.status === 'error'
          ? 'bg-red-500'
          : 'bg-zinc-500'

  return (
    <div className="min-w-[280px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Deploy</p>
          <p className="text-sm font-semibold text-zinc-100">{project.name}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{project.githubUrl}</p>
        </div>
        <span
          className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusColor}`}
          title={project.status}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Rama <span className="text-zinc-300">{project.branch}</span>
        {project.lastDeployedAt ? (
          <>
            {' '}
            · último deploy{' '}
            <span className="text-zinc-400">{new Date(project.lastDeployedAt).toLocaleString()}</span>
          </>
        ) : null}
      </p>
      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        className="mt-3 w-full rounded-md bg-teal-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
        onClick={async () => {
          setError(null)
          setBusy(true)
          try {
            await deployProject(project.id)
            await onDeployed()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Deploy fallido')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Desplegando…' : 'docker compose up -d --build'}
      </button>
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  )
}
