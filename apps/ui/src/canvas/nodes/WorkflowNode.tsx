import { useMutation } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState } from 'react'
import type { WorkflowStep } from '@sentinel/shared-types'
import { toast } from 'sonner'
import { runWorkflow } from '../../api/sentinelClient'

const DEFAULT_STEPS: WorkflowStep[] = [
  { type: 'rest', method: 'GET', url: 'https://httpbin.org/get' },
]

export type WorkflowData = { projectId: string }

export function WorkflowNode({ data }: NodeProps<WorkflowData>) {
  const [log, setLog] = useState<string[]>([])
  const [json, setJson] = useState(JSON.stringify(DEFAULT_STEPS, null, 2))

  const m = useMutation({
    mutationFn: async () => {
      let steps: WorkflowStep[]
      try {
        steps = JSON.parse(json) as WorkflowStep[]
      } catch {
        throw new Error('JSON de pasos inválido')
      }
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Define al menos un paso')
      }
      setLog([])
      await runWorkflow(data.projectId, steps, (ev) => {
        setLog((l) => [...l, JSON.stringify(ev)].slice(-40))
      })
    },
    onSuccess: () => toast.success('Workflow terminado'),
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="w-[360px] rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase text-zinc-500">Workflow (SSE)</p>
        <textarea
          className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] text-zinc-200"
          rows={6}
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
        />
        <button
          type="button"
          disabled={m.isPending}
          className="mt-2 w-full rounded bg-fuchsia-700 py-1 text-[11px] text-white disabled:opacity-40"
          onClick={() => m.mutate()}
        >
          {m.isPending ? 'Ejecutando…' : 'Ejecutar pasos'}
        </button>
      </div>
      <pre className="max-h-40 overflow-auto p-2 font-mono text-[10px] text-zinc-400">
        {log.length ? log.join('\n') : '—'}
      </pre>
    </div>
  )
}
