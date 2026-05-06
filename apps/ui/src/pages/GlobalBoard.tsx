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
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Sentinel</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pizarras libres para organizar multiples proyectos y widgets operacionales.
        </p>
      </header>

      {error ? (
        <p className="mb-4 text-amber-400">{(error as Error).message}</p>
      ) : null}

      <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-medium text-zinc-300">+ Nueva pizarra</h2>
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
            Nombre de pizarra
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
              value={boardName}
              onChange={(event) => setBoardName(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={createBoardMutation.isPending}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {createBoardMutation.isPending ? 'Creando...' : 'Crear pizarra'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Pizarras ({boards.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <div
              key={board.id}
              className="flex flex-col rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    className="text-lg font-medium text-white hover:text-violet-300"
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
