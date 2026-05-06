export type ContextMenuAction = {
  id: string
  label: string
  danger?: boolean
  onSelect: () => void
}

type ContextMenuProps = {
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menu contextual"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-56 rounded-md border border-zinc-700 bg-zinc-900 p-1 text-sm text-zinc-100 shadow-2xl"
        style={{ left: x, top: y }}
        role="menu"
      >
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            className={
              action.danger
                ? 'block w-full rounded px-3 py-2 text-left text-red-300 hover:bg-red-950/40'
                : 'block w-full rounded px-3 py-2 text-left hover:bg-zinc-800'
            }
            onClick={() => {
              action.onSelect()
              onClose()
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  )
}
