import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import { useLogStream } from '../../hooks/useLogStream'

export type LogStreamData = {
  projectId: string
}

export function LogStreamNode({ data }: NodeProps<LogStreamData>) {
  const { lines, clear } = useLogStream(data.projectId)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  return (
    <div className="flex h-[320px] w-[420px] flex-col rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-zinc-500" />
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Logs</p>
        <button
          type="button"
          className="text-xs text-zinc-400 hover:text-zinc-200"
          onClick={clear}
        >
          Limpiar
        </button>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-all px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
        {lines.length === 0 ? (
          <span className="text-zinc-600">Esperando líneas de docker compose logs…</span>
        ) : (
          lines.map((line, i) => (
            <span key={`${i}-${line.slice(0, 24)}`}>
              {line}
              {'\n'}
            </span>
          ))
        )}
        <div ref={bottomRef} />
      </pre>
    </div>
  )
}
