import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

function useTopbarTitle(): { crumb: string; title: string } {
  const location = useLocation()
  const params = useParams()

  return useMemo(() => {
    if (location.pathname === '/') {
      return { crumb: 'Pizarras', title: 'Pizarras' }
    }
    if (location.pathname.startsWith('/b/')) {
      return { crumb: 'Pizarras', title: `Board ${params.boardId ?? ''}`.trim() }
    }
    if (location.pathname.startsWith('/system')) {
      return { crumb: 'Sistema', title: 'Sistema' }
    }
    if (location.pathname.startsWith('/settings')) {
      return { crumb: 'Ajustes', title: 'Ajustes' }
    }
    return { crumb: 'Sentinel', title: 'Sentinel' }
  }, [location.pathname, params.boardId])
}

export function Topbar() {
  const { crumb, title } = useTopbarTitle()
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/80 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {crumb === 'Pizarras' ? (
            <Link className="hover:text-zinc-200" to="/">
              Pizarras
            </Link>
          ) : (
            <span>{crumb}</span>
          )}
          <span className="text-zinc-700">/</span>
          <span className="truncate text-zinc-300">{title}</span>
        </div>
        <p className="truncate text-sm font-semibold text-zinc-100">Sentinel</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-zinc-500">Servidor</span>
          <button
            type="button"
            className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
            title="Selector placeholder"
          >
            local
          </button>
        </div>
        <button
          type="button"
          className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-900"
          title="Acción placeholder"
        >
          Feedback
        </button>
      </div>
    </header>
  )
}

