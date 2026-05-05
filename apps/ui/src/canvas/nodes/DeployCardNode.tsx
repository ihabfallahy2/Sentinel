import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  deployProject,
  fetchDeployments,
  fetchProject,
  rollbackProject,
} from '../../api/sentinelClient'

export type DeployCardData = { projectId: string }

export function DeployCardNode({ data }: NodeProps<DeployCardData>) {
  const qc = useQueryClient()
  const [rollbackId, setRollbackId] = useState('')
  const { data: project } = useQuery({
    queryKey: ['project', data.projectId],
    queryFn: () => fetchProject(data.projectId),
  })
  const { data: deployments = [] } = useQuery({
    queryKey: ['deployments', data.projectId],
    queryFn: () => fetchDeployments(data.projectId),
    refetchInterval: 10_000,
  })

  const deployM = useMutation({
    mutationFn: (pull: boolean) => deployProject(data.projectId, { pull }),
    onSuccess: () => {
      toast.success('Deploy completado')
      void qc.invalidateQueries({ queryKey: ['project', data.projectId] })
      void qc.invalidateQueries({ queryKey: ['deployments', data.projectId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rollbackM = useMutation({
    mutationFn: () => rollbackProject(data.projectId, rollbackId),
    onSuccess: () => {
      toast.success('Rollback lanzado')
      void qc.invalidateQueries({ queryKey: ['project', data.projectId] })
      void qc.invalidateQueries({ queryKey: ['deployments', data.projectId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!project) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
        Cargando proyecto…
      </div>
    )
  }

  const statusColor =
    project.status === 'online'
      ? 'bg-emerald-500'
      : project.status === 'building'
        ? 'bg-amber-400 animate-pulse'
        : project.status === 'error'
          ? 'bg-red-500'
          : 'bg-zinc-500'

  const successDeps = deployments.filter((d) => d.status === 'success' || d.status === 'rolled_back')

  return (
    <div className="min-w-[280px] max-w-[320px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
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
            · último{' '}
            <span className="text-zinc-400">{new Date(project.lastDeployedAt).toLocaleString()}</span>
          </>
        ) : null}
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <button
          type="button"
          disabled={deployM.isPending}
          className="w-full rounded-md bg-teal-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50"
          onClick={() => deployM.mutate(false)}
        >
          {deployM.isPending ? 'Desplegando…' : 'Deploy (compose up)'}
        </button>
        <button
          type="button"
          disabled={deployM.isPending}
          className="w-full rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          onClick={() => deployM.mutate(true)}
        >
          Pull + deploy
        </button>
        <div className="flex gap-1">
          <select
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-[10px] text-zinc-200"
            value={rollbackId}
            onChange={(e) => setRollbackId(e.target.value)}
          >
            <option value="">Rollback a…</option>
            {successDeps.map((d) => (
              <option key={d.id} value={d.id}>
                {d.commitSha.slice(0, 7)} — {d.commitMessage.slice(0, 40)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!rollbackId || rollbackM.isPending}
            className="rounded bg-amber-700 px-2 py-1 text-[10px] text-white disabled:opacity-40"
            onClick={() => rollbackM.mutate()}
          >
            Rollback
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  )
}
