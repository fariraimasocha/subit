import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { StatusBadge } from '~/components/status-badge.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table.tsx'
import type { Project } from '~/lib/project.ts'
import { projectsQuery, qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { deleteProjectFn } from '~/server/api.ts'

export const Route = createFileRoute('/dashboard/projects')({ component: Projects })

const col = createColumnHelper<Project>()

function Projects() {
  const qc = useQueryClient()
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const [sorting, setSorting] = useState<SortingState>([{ id: 'created_at', desc: true }])
  // Deleting drops the row and the video with it, so it asks first.
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => deleteProjectFn({ data: { id } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects })
      toast.success('Project deleted')
    },
    onSettled: () => setPendingDelete(null),
  })

  const columns = [
    col.accessor('name', {
      header: 'Name',
      cell: (c) => (
        <Link to="/editor/$id" params={{ id: c.row.original.id }} className="font-medium hover:underline">
          {c.getValue()}
        </Link>
      ),
    }),
    col.accessor('status', { header: 'Status', cell: (c) => <StatusBadge status={c.getValue()} /> }),
    col.accessor('duration', {
      header: 'Length',
      cell: (c) => {
        const d = c.getValue()
        if (!d) return <span className="text-muted-foreground">-</span>
        // Round first, then split, or 179.6s formats as 2:60.
        const total = Math.round(d)
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
      },
    }),
    col.accessor((r) => r.cues.length, {
      id: 'cues',
      header: 'Cues',
      cell: (c) => c.getValue() || <span className="text-muted-foreground">-</span>,
    }),
    col.accessor('created_at', {
      header: 'Created',
      cell: (c) => new Date(c.getValue()).toLocaleDateString(),
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: (c) => (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${c.row.original.name}`}
          onClick={() => setPendingDelete(c.row.original)}
        >
          <Trash2 className="size-4" />
        </Button>
      ),
    }),
  ]

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Could not load projects</CardTitle>
          <CardDescription>{(error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

      {known && !ready ? (
        <SetupNotice config={config} />
      ) : isPending ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead
                        key={h.id}
                        onClick={h.column.getToggleSortingHandler()}
                        className={h.column.getCanSort() ? 'cursor-pointer select-none' : undefined}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[h.column.getIsSorted() as string] ?? ''}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                      No projects yet.{' '}
                      <Link to="/dashboard/new" className="underline">
                        Upload one
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button size="sm" variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} and its transcript go for good. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep it</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
            >
              {remove.isPending ? 'Deleting' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
