import { useQuery } from '@tanstack/react-query'
import { fetchSystemStats } from '../api/sentinelClient'

type Stats = {
  cpu?: { load?: number }
  mem?: { used?: number; total?: number }
  disk?: { used?: number; size?: number }
}

export function SystemPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['system-stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 10_000,
  })

  const stats = (data ?? null) as Stats | null

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Sistema</h1>
        <p className="mt-1 text-sm text-zinc-400">Host stats estilo panel operativo.</p>
      </header>

      {error ? <p className="text-sm text-amber-400">{(error as Error).message}</p> : null}
      {isLoading ? <p className="text-sm text-zinc-500">Cargando…</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">CPU load</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">
            {formatMetricValue(stats?.cpu?.load, '%')}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">RAM</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {formatBytes(stats?.mem?.used)} <span className="text-zinc-600">/</span>{' '}
            {formatBytes(stats?.mem?.total)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Disk</p>
          <p className="mt-2 text-sm font-semibold text-zinc-100">
            {formatBytes(stats?.disk?.used)} <span className="text-zinc-600">/</span>{' '}
            {formatBytes(stats?.disk?.size)}
          </p>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) {
    return 'n/a'
  }
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

function formatMetricValue(value?: number, suffix = ''): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'n/a'
  }
  return `${value.toFixed(1)}${suffix}`
}

