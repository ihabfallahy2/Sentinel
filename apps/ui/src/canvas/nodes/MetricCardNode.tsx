import { useQuery } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { fetchSystemStats } from '../../api/sentinelClient'

export type MetricCardData = { projectId: string }

type Stats = {
  cpu: { load: number }
  mem: { total: number; used: number; free: number }
}

export function MetricCardNode({ data }: NodeProps<MetricCardData>) {
  void data
  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => fetchSystemStats() as Promise<Stats>,
    refetchInterval: 5000,
  })

  const load = stats?.cpu?.load ?? 0
  const mem = stats?.mem
  const usedPct = mem && mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : 0

  return (
    <div className="w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <p className="text-xs uppercase text-zinc-500">Métricas host</p>
      <p className="mt-2 text-2xl font-semibold text-teal-400">{load.toFixed(1)}%</p>
      <p className="text-[10px] text-zinc-500">CPU load</p>
      <p className="mt-2 text-sm text-zinc-200">{usedPct}% RAM</p>
      <p className="text-[10px] text-zinc-500">
        {mem ? `${(mem.used / 1024 ** 3).toFixed(1)} / ${(mem.total / 1024 ** 3).toFixed(1)} GiB` : '—'}
      </p>
    </div>
  )
}
