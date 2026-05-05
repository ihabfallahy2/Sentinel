import { useMutation } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { runScript } from '../../api/sentinelClient'

export type ScriptRunnerData = { projectId: string }

export function ScriptRunnerNode({ data }: NodeProps<ScriptRunnerData>) {
  const [path, setPath] = useState('deploy.sh')
  const [out, setOut] = useState('')

  const m = useMutation({
    mutationFn: () => runScript(data.projectId, path.trim()),
    onSuccess: (r) => {
      setOut(`${r.stdout}\n${r.stderr}`.trim())
      if (!r.ok) {
        toast.error(`Script exit ${r.code}`)
      } else {
        toast.success('Script OK')
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex w-[340px] flex-col rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase text-zinc-500">Script runner</p>
        <div className="mt-2 flex gap-1">
          <input
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <button
            type="button"
            disabled={m.isPending}
            className="rounded bg-cyan-700 px-2 py-1 text-[11px] text-white disabled:opacity-40"
            onClick={() => m.mutate()}
          >
            Run
          </button>
        </div>
      </div>
      <pre className="max-h-40 overflow-auto p-2 font-mono text-[10px] text-zinc-400">{out || '—'}</pre>
    </div>
  )
}
