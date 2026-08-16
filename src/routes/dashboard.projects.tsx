import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Clapperboard, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { FloatingLabelInput } from '~/components/interior/floating-label.tsx'
import { Pagination } from '~/components/interior/pagination.tsx'
import { SkeletonSwap } from '~/components/interior/skeleton-swap.tsx'
import { SortableTable, type SortState } from '~/components/interior/sortable-table.tsx'
import { StatusBadge } from '~/components/status-badge.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog.tsx'
import type { Project } from '~/lib/project.ts'
import { projectsQuery, qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { EmptyState } from '~/components/empty-state.tsx'
import { debugIngestFn, deleteProjectFn } from '~/server/api.ts'

export const Route = createFileRoute('/dashboard/projects')({ component: Projects })

const col = createColumnHelper<Project>()

function formatLength(d: number | null) {
  if (!d) return null
  const total = Math.round(d)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Projects() {
  const qc = useQueryClient()
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>({ columnId: 'created_at', direction: 'desc' })
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

  const filterColumns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Name',
        cell: (c) => c.getValue(),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: data ?? [],
    columns: filterColumns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _id, value: string) =>
      row.original.name.toLowerCase().includes(value.toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  const pageRows = table.getRowModel().rows.map((r) => r.original)
  const pageCount = table.getPageCount() || 1
  const pageIndex = table.getState().pagination.pageIndex

  const interiorColumns = useMemo(
    () => [
      {
        id: 'name',
        header: 'Name',
        value: (p: Project) => p.name,
        cell: (p: Project) => (
          <Link to="/editor/$id" params={{ id: p.id }} className="font-medium text-foreground hover:underline">
            {p.name}
          </Link>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: '140px',
        value: (p: Project) => p.status,
        cell: (p: Project) => <StatusBadge status={p.status} />,
      },
      {
        id: 'duration',
        header: 'Length',
        width: '88px',
        align: 'end' as const,
        numeric: true,
        value: (p: Project) => p.duration,
        cell: (p: Project) => formatLength(p.duration) ?? <span className="text-muted-foreground">-</span>,
      },
      {
        id: 'cues',
        header: 'Cues',
        width: '72px',
        align: 'end' as const,
        numeric: true,
        value: (p: Project) => p.cues.length,
        cell: (p: Project) => p.cues.length || <span className="text-muted-foreground">-</span>,
      },
      {
        id: 'created_at',
        header: 'Created',
        width: '120px',
        value: (p: Project) => p.created_at,
        cell: (p: Project) => new Date(p.created_at).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: '',
        width: '48px',
        align: 'end' as const,
        sortable: false,
        cell: (p: Project) => (
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${p.name}`}
            onClick={() => {
              setPendingDelete(p)
              // #region agent log
              fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix-4',hypothesisId:'F',location:'dashboard.projects.tsx:trash',message:'Trash clicked, opening delete modal',data:{hasName:!!p.name},timestamp:Date.now()})}).catch(()=>{});
              void debugIngestFn({
                data: {
                  location: 'dashboard.projects.tsx:trash',
                  message: 'Trash clicked, opening delete modal',
                  hypothesisId: 'F',
                  runId: 'post-fix-4',
                  data: { hasName: !!p.name },
                },
              }).catch(() => {})
              // #endregion
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ),
      },
    ],
    [],
  )

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

  useEffect(() => {
    if (!pendingDelete) return
    const id = window.requestAnimationFrame(() => {
      const dialog = document.querySelector('[role="dialog"]')
      const footer = dialog?.querySelector('[data-debug="delete-footer"]')
      const buttons = dialog
        ? Array.from(dialog.querySelectorAll('button')).map((b) => ({
            text: (b.textContent ?? '').trim(),
            aria: b.getAttribute('aria-label'),
            w: Math.round(b.getBoundingClientRect().width),
            h: Math.round(b.getBoundingClientRect().height),
          }))
        : []
      const payload = {
        buttonCount: buttons.length,
        buttons,
        hasKeepIt: buttons.some((b) => b.text === 'Keep it'),
        emptyLabeled: buttons.filter((b) => !b.text && b.aria !== 'Close').length,
        footerHtml: footer?.innerHTML?.slice(0, 800) ?? null,
      }
      // #region agent log
      fetch('http://127.0.0.1:7798/ingest/24c2d816-da87-4d95-aeda-612f37f3fd00',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8dc48'},body:JSON.stringify({sessionId:'d8dc48',runId:'post-fix-2',hypothesisId:'F',location:'dashboard.projects.tsx:footer-dom',message:'Delete modal button DOM',data:payload,timestamp:Date.now()})}).catch(()=>{});
      void debugIngestFn({
        data: {
          location: 'dashboard.projects.tsx:footer-dom',
          message: 'Delete modal button DOM',
          hypothesisId: 'F',
          runId: 'post-fix-2',
          data: payload,
        },
      }).catch(() => {})
      // #endregion
    })
    return () => window.cancelAnimationFrame(id)
  }, [pendingDelete])

  const empty = !isPending && table.getFilteredRowModel().rows.length === 0

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <Button asChild className="shadow-lg shadow-brand/25">
            <Link to="/dashboard/new">
              <Upload className="size-4" />
              New upload
            </Link>
          </Button>
        </div>
        <FloatingLabelInput
          className="max-w-sm"
          label="Search projects"
          type="search"
          value={search}
          onChange={setSearch}
        />
      </header>

      {known && !ready ? (
        <SetupNotice config={config} />
      ) : isPending ? (
        <SkeletonSwap ready={false} reserve={280} label="Projects" className="rounded-xl border border-white/10 p-4">
          {null}
        </SkeletonSwap>
      ) : empty ? (
        <EmptyState
          icon={Clapperboard}
          title={search ? 'No matching projects' : 'No projects yet'}
          body={
            search
              ? 'Nothing in the list matches that name. Clear the search to see every project.'
              : 'Once you upload a video it lands here with its status, length and cue count, ready to open in the editor.'
          }
          action={
            search ? undefined : (
              <Button asChild size="lg">
                <Link to="/dashboard/new">
                  <Upload className="size-4" />
                  Upload a video
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <SortableTable
            label="Projects"
            rows={pageRows}
            getRowId={(p) => p.id}
            getRowLabel={(p) => p.name}
            columns={interiorColumns}
            sort={sort}
            onSortChange={setSort}
            className="border-white/10 bg-surface-2 shadow-none"
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Pagination
              count={pageCount}
              page={pageIndex + 1}
              label="Projects pages"
              onPageChange={(next) => table.setPageIndex(next - 1)}
            />
          </div>
        </>
      )}

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="border-white/10 bg-surface-1 shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle>Delete this project?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.name} and its transcript go for good. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter data-debug="delete-footer">
            <Button type="button" variant="secondary" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              className="border border-danger/30 bg-danger text-danger-foreground hover:bg-danger/90 dark:bg-danger"
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
