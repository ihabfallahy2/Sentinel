import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { createBoard, fetchBoards } from '../api/sentinelClient'

export function GlobalBoard() {
  const qc = useQueryClient()
  const [boardName, setBoardName] = useState('')

  const { data: boards = [], error } = useQuery({
    queryKey: ['boards'],
    queryFn: fetchBoards,
  })

  const createBoardMutation = useMutation({
    mutationFn: () => createBoard({ name: boardName.trim() }),
    onSuccess: () => {
      toast.success('Pizarra creada')
      setBoardName('')
      void qc.invalidateQueries({ queryKey: ['boards'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Pizarras</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Home estilo Railway: boards como cards compactas y acción “New”.
          </p>
        </div>
        <button
          type="button"
          className="rounded bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500"
          onClick={() => {
            const el = document.getElementById('new-board-name')
            if (el instanceof HTMLInputElement) {
              el.focus()
              el.select()
            }
          }}
        >
          + New
        </button>
      </header>

      {error ? (
        <p className="mb-4 text-amber-400">{(error as Error).message}</p>
      ) : null}

      <section className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">New board</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (boardName.trim().length === 0) {
              toast.error('Introduce un nombre para la pizarra')
              return
            }
            createBoardMutation.mutate()
          }}
        >
          <label className="flex-1 text-xs text-zinc-500">
            Nombre
            <input
              id="new-board-name"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
              value={boardName}
              onChange={(event) => setBoardName(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={createBoardMutation.isPending}
            className="rounded bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          >
            {createBoardMutation.isPending ? 'Creando...' : 'Crear'}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Boards ({boards.length})
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className="group flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 hover:bg-zinc-900/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    className="text-base font-semibold text-zinc-100 hover:text-violet-300"
                    to={`/b/${board.id}`}
                  >
                    {board.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {board.projectCount} proyectos en esta pizarra
                  </p>
                </div>
                <span
                  className={
                    board.status === 'online'
                      ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500'
                      : board.status === 'error'
                        ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-red-500'
                        : board.status === 'building'
                          ? 'h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400'
                          : 'h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-500'
                  }
                  title={board.status}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                Estado agregado de servicios: {board.status}
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  className="w-full rounded bg-zinc-800 py-1.5 text-center text-xs text-zinc-100 hover:bg-zinc-700"
                  to={`/b/${board.id}`}
                >
                  Abrir pizarra
                </Link>
              </div>
            </div>
          ))}
          {boards.length === 0 ? (
            <p className="text-sm text-zinc-600">Aún no hay pizarras.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
