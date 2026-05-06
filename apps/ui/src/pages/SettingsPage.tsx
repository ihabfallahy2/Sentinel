import { useEffect, useMemo, useState } from 'react'

function getStoredApiKey(): string {
  return localStorage.getItem('sentinel_api_key') ?? ''
}

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    setApiKey(getStoredApiKey())
  }, [])

  const hasKey = useMemo(() => apiKey.trim().length > 0, [apiKey])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Ajustes</h1>
        <p className="mt-1 text-sm text-zinc-400">Settings a nivel aplicación (no proyecto).</p>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Connection</h2>
        <p className="mt-1 text-xs text-zinc-500">
          `x-api-key` se guarda en localStorage y se usa en todas las llamadas.
        </p>
        <div className="mt-3 grid gap-2">
          <label className="text-xs text-zinc-400">
            API Key
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sentinel_..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
              onClick={() => localStorage.setItem('sentinel_api_key', apiKey.trim())}
              disabled={!hasKey}
            >
              Guardar
            </button>
            <button
              type="button"
              className="rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-900"
              onClick={() => {
                localStorage.removeItem('sentinel_api_key')
                setApiKey('')
              }}
            >
              Limpiar
            </button>
            <span className="self-center text-xs text-zinc-500">
              Estado: {hasKey ? 'configurada' : 'vacía'}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">GitHub</h2>
        <p className="mt-2 text-xs text-zinc-500">
          El backend usa `GITHUB_TOKEN` para listar repos y ramas.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">About</h2>
        <p className="mt-2 text-xs text-zinc-500">Versión/uptime: pendiente.</p>
      </section>
    </div>
  )
}

