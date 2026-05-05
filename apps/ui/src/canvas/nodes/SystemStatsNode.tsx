import { useQuery } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { fetchSystemStats } from '../../api/sentinelClient'

export function SystemStatsNode(_props: NodeProps<Record<string, never>>) {
  const { data } = useQuery({
    queryKey: ['system-stats'],
    queryFn: () => fetchSystemStats(),
    refetchInterval: 8000,
  })

  return (
    <div className="min-w-[240px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <p className="text-xs uppercase text-zinc-500">System stats</p>
      <pre className="mt-2 max-h-48 overflow-auto text-[10px] text-zinc-400">
        {data ? JSON.stringify(data, null, 2) : 'Cargando…'}
      </pre>
    </div>
  )
}
