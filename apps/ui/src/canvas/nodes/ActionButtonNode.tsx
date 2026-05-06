import { useMutation } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { executeWidget } from '../../api/sentinelClient'

export type ActionButtonData = {
  projectId: string
  url?: string
  method?: string
}

export function ActionButtonNode({ data }: NodeProps<ActionButtonData>) {
  const [url, setUrl] = useState(data.url ?? 'https://httpbin.org/get')
  const [method, setMethod] = useState(data.method ?? 'GET')

  const m = useMutation({
    mutationFn: () =>
      executeWidget({
        type: 'action_button',
        projectId: data.projectId,
        config: { url, method },
      }),
    onSuccess: () => toast.success('OK'),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <p className="text-xs uppercase text-zinc-500">Acción HTTP</p>
      <input
        className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-100"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <div className="mt-2 flex gap-1">
        <select
          className="rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-[10px]"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {['GET', 'POST'].map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={m.isPending}
          className="flex-1 rounded bg-lime-700 py-1 text-[11px] text-white disabled:opacity-40"
          onClick={() => m.mutate()}
        >
          Ejecutar
        </button>
      </div>
    </div>
  )
}
