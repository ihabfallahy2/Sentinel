import { NavLink } from 'react-router-dom'

type NavItem = {
  to: string
  label: string
  short: string
}

const items: NavItem[] = [
  { to: '/', label: 'Pizarras', short: 'B' },
  { to: '/system', label: 'Sistema', short: 'S' },
  { to: '/settings', label: 'Ajustes', short: '⚙' },
]

export function Sidebar() {
  return (
    <aside className="flex w-[64px] flex-col items-center gap-2 border-r border-zinc-900 bg-zinc-950/60 px-2 py-3">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm font-semibold tracking-tight">
        Se
      </div>
      <nav className="flex flex-1 flex-col items-center gap-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              isActive
                ? 'flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-sm font-semibold text-white shadow'
                : 'flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200 hover:bg-zinc-900'
            }
          >
            {item.short}
          </NavLink>
        ))}
      </nav>
      <div className="h-px w-full bg-zinc-900" />
      <a
        href="https://github.com"
        target="_blank"
        rel="noreferrer"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-900"
        title="Docs (placeholder)"
      >
        ?
      </a>
    </aside>
  )
}

