import { useQuery } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { fetchProject } from '../../api/sentinelClient'

export type DeployCardData = { projectId: string }

export function DeployCardNode({ data }: NodeProps<DeployCardData>) {
  const { data: project } = useQuery({
    queryKey: ['project', data.projectId],
    queryFn: () => fetchProject(data.projectId),
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

  return (
    <div className="min-w-[260px] max-w-[300px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Proyecto</p>
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
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  )
}
