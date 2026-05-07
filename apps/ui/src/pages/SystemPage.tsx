import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import {
  fetchMaintenanceStatus,
  fetchMaintenanceRuns,
  fetchSecurityStatus,
  fetchSshAttempts,
  fetchSystemCpuHistory,
  fetchSystemDiskDirs,
  fetchSystemLogs,
  fetchSystemMetrics,
  fetchSystemNetwork,
  fetchSystemServices,
  runMaintenanceNow,
} from '../api/sentinelClient'

type TabId = 'resumen' | 'ejecuciones' | 'logs' | 'seguridad'
type LogLevelFilter = 'all' | 'err' | 'warn' | 'ok' | 'info'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

export function SystemPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('resumen')
  const [logFilter, setLogFilter] = useState<LogLevelFilter>('all')

  const { data: metrics } = useQuery({
    queryKey: ['system-metrics-v2'],
    queryFn: fetchSystemMetrics,
    refetchInterval: 5_000,
  })
  const { data: services } = useQuery({
    queryKey: ['system-services-v2'],
    queryFn: fetchSystemServices,
    refetchInterval: 30_000,
  })
  const { data: network } = useQuery({
    queryKey: ['system-network-v2'],
    queryFn: fetchSystemNetwork,
    refetchInterval: 30_000,
  })
  const { data: cpuHistory } = useQuery({
    queryKey: ['system-cpu-history-v2'],
    queryFn: fetchSystemCpuHistory,
    refetchInterval: 30_000,
  })
  const { data: diskDirs } = useQuery({
    queryKey: ['system-disk-dirs-v2'],
    queryFn: fetchSystemDiskDirs,
    refetchInterval: 30_000,
  })
  const { data: runs } = useQuery({
    queryKey: ['maintenance-runs-v2'],
    queryFn: fetchMaintenanceRuns,
    enabled: activeTab === 'ejecuciones',
  })
  const { data: maintenanceStatus } = useQuery({
    queryKey: ['maintenance-status-v2'],
    queryFn: fetchMaintenanceStatus,
    refetchInterval: pendingRunId ? 3_000 : 10_000,
  })
  const { data: logs, refetch: refetchLogs, isFetching: loadingLogs } = useQuery({
    queryKey: ['system-logs-v2', logFilter],
    queryFn: () => fetchSystemLogs(logFilter),
    enabled: activeTab === 'logs',
  })
  const { data: security } = useQuery({
    queryKey: ['system-security-v2'],
    queryFn: fetchSecurityStatus,
    enabled: activeTab === 'seguridad',
  })
  const { data: sshAttempts } = useQuery({
    queryKey: ['system-ssh-attempts-v2'],
    queryFn: fetchSshAttempts,
    enabled: activeTab === 'seguridad',
  })

  const runNow = useMutation({
    mutationFn: runMaintenanceNow,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['maintenance-runs-v2'] })
      await qc.invalidateQueries({ queryKey: ['system-logs-v2'] })
    },
  })

  const lastRun = useMemo(() => runs?.runs?.[0]?.started_at ?? null, [runs?.runs])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-zinc-100">Sistema</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-950/40 px-2 py-0.5 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              estable
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${
                maintenanceStatus?.running
                  ? 'bg-amber-950/40 text-amber-300'
                  : maintenanceStatus?.last_exit_code && maintenanceStatus.last_exit_code !== 0
                    ? 'bg-red-950/40 text-red-300'
                    : 'bg-zinc-900 text-zinc-400'
              }`}
            >
              {maintenanceStatus?.running
                ? 'maintenance: running'
                : maintenanceStatus?.last_exit_code && maintenanceStatus.last_exit_code !== 0
                  ? `maintenance: error (${maintenanceStatus.last_exit_code})`
                  : 'maintenance: idle'}
            </span>
            <span>Última ejecución: {lastRun ? new Date(lastRun).toLocaleString() : 'n/a'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => runNow.mutate()}
          disabled={runNow.isPending}
          className="rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runNow.isPending ? 'Ejecutando…' : 'Run now'}
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="CPU"
          value={`${metrics?.cpu.percent?.toFixed(1) ?? 'n/a'}%`}
          subtitle={`${metrics?.cpu.cores ?? '-'} cores`}
          percent={metrics?.cpu.percent ?? 0}
        />
        <MetricCard
          label="RAM"
          value={`${metrics?.ram.percent?.toFixed(1) ?? 'n/a'}%`}
          subtitle={`${metrics?.ram.used_gb ?? 'n/a'} / ${metrics?.ram.total_gb ?? 'n/a'} GB`}
          percent={metrics?.ram.percent ?? 0}
        />
        <MetricCard
          label="Disk"
          value={`${metrics?.disk.percent?.toFixed(1) ?? 'n/a'}%`}
          subtitle={`${metrics?.disk.used_gb ?? 'n/a'} / ${metrics?.disk.total_gb ?? 'n/a'} GB`}
          percent={metrics?.disk.percent ?? 0}
        />
        <MetricCard
          label="Uptime"
          value={metrics?.uptime.human ?? 'n/a'}
          subtitle={`${metrics?.uptime.seconds ?? 0}s`}
          percent={100}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {(['resumen', 'ejecuciones', 'logs', 'seguridad'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? 'rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white shadow'
                : 'rounded px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800'
            }
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'resumen' ? (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Servicios</h2>
              <SourceBadge source={services?.source} reason={services?.source_reason} />
              <div className="space-y-2 text-sm">
                {services?.services?.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between rounded border border-transparent px-1 py-1 transition hover:border-zinc-800 hover:bg-zinc-950/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${dotClass(service.level)}`} />
                      <span className="text-zinc-200">{service.name}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[11px] ${badgeClass(service.level)}`}>
                      {service.level === 'ok' ? 'activo' : service.level === 'warn' ? 'alto uso' : 'inactivo'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                CPU últimas 12h
              </h2>
              <SourceBadge source={cpuHistory?.source} reason={cpuHistory?.source_reason} />
              <CpuHistoryChart labels={cpuHistory?.labels ?? []} values={cpuHistory?.values ?? []} />
            </section>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Top dirs</h2>
              <SourceBadge source={diskDirs?.source} reason={diskDirs?.source_reason} />
              <div className="space-y-2">
                {diskDirs?.dirs?.map((dir) => (
                  <div key={dir.path} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-zinc-300">{dir.path}</span>
                      <span className="text-zinc-500">{dir.size_gb.toFixed(1)} GB</span>
                    </div>
                    <div className="h-1.5 rounded bg-zinc-800">
                      <div className="h-1.5 rounded bg-violet-500" style={{ width: `${dir.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Red</h2>
              <SourceBadge source={network?.source} reason={network?.source_reason} />
              <KeyRow label="Public IP" value={network?.public_ip ?? 'n/a'} mono />
              <KeyRow label="DNS latency" value={`${network?.dns_latency_ms ?? 'n/a'} ms`} />
              <KeyRow label="Active connections" value={String(network?.active_connections ?? 'n/a')} />
              <KeyRow label="Open ports" value={(network?.open_ports ?? []).join(', ') || 'n/a'} />
              <KeyRow
                label="RX / TX today"
                value={`${network?.rx_today_gb ?? 'n/a'} / ${network?.tx_today_gb ?? 'n/a'} GB`}
              />
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === 'ejecuciones' ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Ejecuciones</h2>
          <SourceBadge source={runs?.source} reason={runs?.source_reason} />
          <div className="space-y-2">
            {runs?.runs?.map((run) => (
              <div
                key={run.id}
                className="grid items-center gap-2 rounded border border-zinc-800 bg-zinc-950/50 p-2 text-xs md:grid-cols-[120px,160px,120px,100px,1fr]"
              >
                <span className={`rounded px-2 py-0.5 text-center ${badgeClass(run.status)}`}>
                  {run.status === 'ok' ? 'Completado' : run.status === 'warn' ? 'Advertencias' : 'Error'}
                </span>
                <span className="text-zinc-300">{new Date(run.started_at).toLocaleString()}</span>
                <span className="text-zinc-500">{run.duration_seconds}s</span>
                <span className="text-zinc-500">
                  {run.tasks_ok}/{run.tasks_total}
                </span>
                <span className="truncate font-mono text-zinc-400">{run.backup_file}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'logs' ? (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Logs</h2>
            <SourceBadge source={logs?.source} reason={logs?.source_reason} />
            <div className="flex gap-2">
              <select
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value as LogLevelFilter)}
              >
                <option value="all">Todos</option>
                <option value="err">Errores</option>
                <option value="warn">Advertencias</option>
                <option value="ok">OK</option>
                <option value="info">Info</option>
              </select>
              <button
                type="button"
                className="rounded border border-zinc-700 px-2 py-1 text-xs transition hover:bg-zinc-800"
                onClick={() => void refetchLogs()}
              >
                {loadingLogs ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="max-h-80 space-y-1 overflow-auto">
            {logs?.logs?.map((log, index) => (
              <div
                key={`${log.time}-${index}`}
                className={`rounded border border-transparent px-2 py-1 text-xs transition hover:border-zinc-700 ${logBgClass(log.level)}`}
              >
                <span className="mr-2 font-mono text-zinc-500">{log.time}</span>
                <span className="mr-2">{log.level.toUpperCase()}</span>
                <span className="text-zinc-200">{log.message}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'seguridad' ? (
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Estado de seguridad
              </h2>
              <SourceBadge source={security?.source} reason={security?.source_reason} />
              <KeyRow label="Security updates" value={String(security?.security_updates_pending ?? 'n/a')} />
              <KeyRow label="Fail2ban blocked" value={String(security?.fail2ban_blocked_ips ?? 'n/a')} />
              <KeyRow label="Sudo users" value={String(security?.sudo_users_count ?? 'n/a')} />
              <KeyRow
                label="Unexpected SUID"
                value={String(security?.unexpected_suid_files?.length ?? 'n/a')}
              />
              <KeyRow label="UFW" value={security?.ufw_active ? 'active' : 'inactive'} />
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Intentos SSH (24h)
              </h2>
              <SourceBadge source={sshAttempts?.source} reason={sshAttempts?.source_reason} />
              <SshAttemptsChart labels={sshAttempts?.labels ?? []} values={sshAttempts?.values ?? []} />
            </section>
          </div>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">S.M.A.R.T.</h2>
            <div className="space-y-2">
              {security?.disks?.map((disk) => (
                <div
                  key={disk.device}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-mono text-zinc-200">
                      {disk.device} · {disk.capacity} · {disk.type}
                    </p>
                    <p className="text-zinc-500">
                      wear {disk.wear_percent ?? 'n/a'}% · temp {disk.temperature_c ?? 'n/a'}°C
                    </p>
                  </div>
                  <span className={disk.smart_status === 'PASSED' ? badgeClass('ok') : badgeClass('err')}>
                    {disk.smart_status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard(props: { label: string; value: string; subtitle: string; percent: number }) {
  const { label, value, subtitle, percent } = props
  const clamped = Math.max(0, Math.min(100, percent))
  const barColor = clamped > 85 ? 'bg-red-500' : clamped > 70 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-zinc-700">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-medium text-zinc-100">{value}</p>
      <div className="mt-2 h-1.5 rounded bg-zinc-800">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
    </article>
  )
}

function KeyRow(props: { label: string; value: string; mono?: boolean }) {
  const { label, value, mono } = props
  return (
    <div className="mb-2 flex justify-between gap-3 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} text-zinc-200`}>{value}</span>
    </div>
  )
}

function MiniBars({ values, danger = false }: { values: number[]; danger?: boolean }) {
  const max = Math.max(1, ...values)
  return (
    <div className="flex h-28 items-end gap-1 rounded border border-zinc-800 bg-zinc-950/50 p-2">
      {values.map((value, i) => (
        <div
          key={`${i}-${value}`}
          className={`flex-1 rounded-t ${danger ? 'bg-red-500/70' : 'bg-violet-500/70'}`}
          style={{ height: `${Math.max(6, (value / max) * 100)}%` }}
          title={`${value}`}
        />
      ))}
    </div>
  )
}

function CpuHistoryChart({ labels, values }: { labels: string[]; values: number[] }) {
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'CPU %',
        data: values,
        borderColor: 'rgba(167, 139, 250, 0.9)',
        backgroundColor: 'rgba(167, 139, 250, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  }
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { callback: (v) => `${v}%`, color: '#71717a', font: { size: 10 } },
        grid: { color: 'rgba(63,63,70,0.5)' },
      },
      x: {
        ticks: { color: '#71717a', font: { size: 10 } },
        grid: { display: false },
      },
    },
  }
  return (
    <div className="h-40 rounded border border-zinc-800 bg-zinc-950/50 p-2">
      <Line data={data} options={options} />
    </div>
  )
}

function SshAttemptsChart({ labels, values }: { labels: string[]; values: number[] }) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [{ label: 'SSH fails', data: values, backgroundColor: 'rgba(239, 68, 68, 0.7)' }],
  }
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#71717a', font: { size: 10 } },
        grid: { color: 'rgba(63,63,70,0.5)' },
      },
      x: {
        ticks: { color: '#71717a', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
        grid: { display: false },
      },
    },
  }
  return (
    <div className="h-40 rounded border border-zinc-800 bg-zinc-950/50 p-2">
      <Bar data={data} options={options} />
    </div>
  )
}

function badgeClass(level: 'ok' | 'warn' | 'err'): string {
  if (level === 'ok') return 'bg-emerald-950/40 text-emerald-300'
  if (level === 'warn') return 'bg-amber-950/40 text-amber-300'
  return 'bg-red-950/40 text-red-300'
}

function dotClass(level: 'ok' | 'warn' | 'err'): string {
  if (level === 'ok') return 'bg-emerald-500'
  if (level === 'warn') return 'bg-amber-400'
  return 'bg-red-500'
}

function logBgClass(level: 'ok' | 'warn' | 'err' | 'info'): string {
  if (level === 'ok') return 'bg-emerald-950/20'
  if (level === 'warn') return 'bg-amber-950/20'
  if (level === 'err') return 'bg-red-950/20'
  return 'bg-zinc-900'
}

function SourceBadge({ source, reason }: { source?: 'real' | 'fallback'; reason?: string }) {
  const [openReason, setOpenReason] = useState(false)
  if (!source) return null
  const canShowReason = source === 'fallback' && Boolean(reason)

  return (
    <div className="mb-2 flex items-center gap-2">
      <span
        className={`inline-flex rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
          source === 'real' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'
        }`}
      >
        source: {source}
      </span>
      {canShowReason ? (
        <>
          <button
            type="button"
            onClick={() => setOpenReason((prev) => !prev)}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-800/80 bg-amber-950/30 text-[10px] font-semibold text-amber-300 hover:bg-amber-900/40"
            aria-label="Mostrar detalle de fallback"
            title={openReason ? 'Ocultar detalle' : 'Mostrar detalle'}
          >
            i
          </button>
          {openReason ? (
            <p className="max-w-[460px] rounded border border-amber-900/60 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-200">
              {reason}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

