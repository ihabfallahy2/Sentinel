import { useMutation } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { executeWidget } from '../../api/sentinelClient'

export type RestExplorerData = { projectId: string }

export function RestExplorerNode({ data }: NodeProps<RestExplorerData>) {
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('https://httpbin.org/get')
  const [body, setBody] = useState('')
  const [resp, setResp] = useState('')

  const m = useMutation({
    mutationFn: () =>
      executeWidget({
        type: 'rest_explorer',
        projectId: data.projectId,
        config: { method, url, body: body || undefined },
      }),
    onSuccess: (r) => {
      setResp(JSON.stringify(r, null, 2))
      toast.success('Petición enviada')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="w-[360px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase text-zinc-500">REST explorer</p>
        <div className="mt-2 flex gap-1">
          <select
            className="rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-[11px] text-zinc-200"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <textarea
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 p-1 font-mono text-[10px] text-zinc-300"
          rows={3}
          placeholder="Body (opcional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          type="button"
          disabled={m.isPending}
          className="mt-1 w-full rounded bg-sky-700 py-1 text-[11px] text-white disabled:opacity-40"
          onClick={() => m.mutate()}
        >
          Enviar (vía API)
        </button>
      </div>
      <pre className="max-h-36 overflow-auto p-2 font-mono text-[10px] text-zinc-400">{resp || '—'}</pre>
    </div>
  )
}
