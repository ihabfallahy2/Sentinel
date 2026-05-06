import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchEnv, saveEnv } from '../../api/sentinelClient'

export type EnvEditorData = { projectId: string }

export function EnvEditorNode({ data }: NodeProps<EnvEditorData>) {
  const qc = useQueryClient()
  const { data: envData, isLoading } = useQuery({
    queryKey: ['env', data.projectId],
    queryFn: () => fetchEnv(data.projectId),
  })
  const [text, setText] = useState('')
  useEffect(() => {
    if (envData) {
      setText(envData.content)
    }
  }, [envData])

  const m = useMutation({
    mutationFn: () => saveEnv(data.projectId, text),
    onSuccess: () => {
      toast.success('.env guardado')
      void qc.invalidateQueries({ queryKey: ['env', data.projectId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="flex h-[280px] w-[380px] flex-col rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase text-zinc-500">.env</p>
        <button
          type="button"
          disabled={m.isPending || isLoading}
          className="rounded bg-violet-600 px-2 py-1 text-[11px] text-white disabled:opacity-40"
          onClick={() => m.mutate()}
        >
          Guardar
        </button>
      </div>
      <textarea
        className="m-2 min-h-0 flex-1 resize-none rounded border border-zinc-800 bg-zinc-900 p-2 font-mono text-[11px] text-zinc-200"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
    </div>
  )
}
