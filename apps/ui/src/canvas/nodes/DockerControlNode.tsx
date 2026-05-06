import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { toast } from 'sonner'
import { dockerAction } from '../../api/sentinelClient'

export type DockerControlData = { projectId: string }

export function DockerControlNode({ data }: NodeProps<DockerControlData>) {
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: (action: 'start' | 'stop' | 'restart' | 'rebuild') =>
      dockerAction(data.projectId, action),
    onSuccess: (_, action) => {
      toast.success(`Docker: ${action}`)
      void qc.invalidateQueries({ queryKey: ['project', data.projectId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const btn = (label: string, action: 'start' | 'stop' | 'restart' | 'rebuild') => (
    <button
      key={action}
      type="button"
      disabled={m.isPending}
      className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
      onClick={() => m.mutate(action)}
    >
      {label}
    </button>
  )

  return (
    <div className="min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <p className="text-xs font-medium uppercase text-zinc-500">Docker control</p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {btn('Start', 'start')}
        {btn('Stop', 'stop')}
        {btn('Restart', 'restart')}
        {btn('Rebuild', 'rebuild')}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-500" />
    </div>
  )
}
