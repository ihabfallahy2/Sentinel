import { useQuery } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { fetchDeployments } from '../../api/sentinelClient'

export type JobMonitorData = { projectId: string }

export function JobMonitorNode({ data }: NodeProps<JobMonitorData>) {
  const { data: deps = [], isFetching } = useQuery({
    queryKey: ['deployments', data.projectId],
    queryFn: () => fetchDeployments(data.projectId),
    refetchInterval: 5000,
  })

  const recent = deps.slice(0, 6)

  return (
    <div className="w-[280px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <p className="text-xs font-medium uppercase text-zinc-500">
        Deployments / jobs {isFetching ? '…' : ''}
      </p>
      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[10px] text-zinc-300">
        {recent.length === 0 ? (
          <li className="text-zinc-600">Sin historial</li>
        ) : (
          recent.map((d) => (
            <li key={d.id} className="rounded bg-zinc-950/80 px-2 py-1">
              <span
                className={
                  d.status === 'success'
                    ? 'text-emerald-400'
                    : d.status === 'failed'
                      ? 'text-red-400'
                      : d.status === 'building'
                        ? 'text-amber-300'
                        : 'text-zinc-400'
                }
              >
                {d.status}
              </span>{' '}
              <span className="text-zinc-500">{d.commitSha.slice(0, 7)}</span>{' '}
              {d.commitMessage.slice(0, 36)}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
