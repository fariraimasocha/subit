import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { Clapperboard, Pencil, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { StatusBadge } from '~/components/status-badge.tsx'
import { Badge } from '~/components/ui/badge.tsx'
import { Button } from '~/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCardImage,
  CutoutCardMedia,
  CutoutCardOverlay,
  cutoutCardSurfaceClassName,
} from '~/components/ui/cutout-card.tsx'
import { INGEST_STAGES, type Project } from '~/lib/project.ts'
import { qk } from '~/lib/queries.ts'
import { cn } from '~/lib/utils.ts'
import { renameProjectFn, retryIngest } from '~/server/api.ts'

/** m:ss, the same shape the projects table uses. */
function length(sec: number | null) {
  if (!sec) return null
  // Round first, then split, or 179.6s formats as 2:60.
  const total = Math.round(sec)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Ingest reports a named step, not a number, so the percentage is the step's
 * position in the sequence. Coarse on purpose: it moves in four jumps and never
 * goes backwards, which is the only thing a progress readout has to promise.
 *
 * ponytail: four buckets, not a byte counter. Wire a real one only if a stage
 * gets long enough that a quarter of a bar stops being reassuring.
 */
function ingestPct(project: Project) {
  if (project.status !== 'processing' && project.status !== 'uploaded') return null
  const i = INGEST_STAGES.findIndex((s) => s.id === project.stage)
  return i < 0 ? 0 : ((i + 1) / INGEST_STAGES.length) * 100
}

/**
 * The poster is the card. Everything under it captions the picture: name, then
 * one metadata row, then whatever action the status actually calls for.
 *
 * The whole card is the link to the editor, done with a stretched pseudo
 * element on the title rather than a wrapping <a>, so the Retry button on a
 * failed project can sit inside the card and still be its own control.
 */
export function ProjectCard({ project: p }: { project: Project }) {
  const qc = useQueryClient()

  const retry = useMutation({
    mutationFn: () => retryIngest({ data: { id: p.id } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => {
      // The list query drives this card, so re-reading it swaps Failed for
      // Transcribing in place. No reload, no navigation.
      qc.invalidateQueries({ queryKey: qk.projects })
      toast.success(`Retrying ${p.name}`)
    },
  })

  const pct = ingestPct(p)
  const duration = length(p.duration)
  const meta = [new Date(p.created_at).toLocaleDateString(), duration, `${p.cues.length} cues`]
    .filter(Boolean)
    .join(' · ')

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        'group/card relative w-full',
        // The .pen ProjectCard: 14px corners, no drawn edge at all, a real dark
        // drop shadow. On a dark page the card is separated by being lighter
        // than the page and casting a shadow, so the outline was one signal too
        // many. The registry default (a 28px pill with a grey token border and
        // foreground-tinted shadows) inverted that: bright edge, no shadow.
        'rounded-2xl dark:border-transparent dark:shadow-[0_10px_32px_-8px_rgba(0,0,0,0.55)]',
        // One ring around the whole card when the link inside it takes focus,
        // so the tab stop reads as "this card" and not "this line of text".
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand',
      )}
    >
      {/*
        A uniform 16:9 tile that letterboxes the frame rather than a tile shaped
        by the clip. The poster still shows its own aspect ratio, it just does it
        inside a fixed box: most of what goes through here is 9:16 phone video,
        and giving each of those the card's full column width made a tile around
        500px tall and a grid nobody could scan. Contained on the video surface,
        a vertical clip still reads as vertical at a glance.
      */}
      <CutoutCardMedia className="aspect-video w-full bg-video-surface">
        <Poster project={p} />
        <CutoutCardOverlay />

        <div className="absolute bottom-3 left-3">
          <StatusBadge status={p.status} pct={pct} />
        </div>

        {duration && (
          <Badge className="absolute right-3 bottom-3 bg-black/75 tabular-nums text-white">
            {duration}
          </Badge>
        )}
      </CutoutCardMedia>

      {/* A real bar under the poster, because a percentage inside a pill says
          how far along it is but not that it is still moving. */}
      {pct !== null && (
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-brand transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <CutoutCardContent className="p-4">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-medium">
            <Link
              to="/editor/$id"
              params={{ id: p.id }}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {p.name}
            </Link>
          </h3>
          <RenameProject project={p} />
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{meta}</p>

        {p.status === 'error' && (
          <>
            {/* The reason, not just the word on the pill. Clamped because an
                ffmpeg error runs to several lines and the editor shows it in
                full anyway. */}
            <p className="mt-3 line-clamp-2 text-sm text-danger">
              {p.error ?? 'Processing failed.'}
            </p>
            {/* relative, so it sits above the stretched link and stays its own
                click target. */}
            <Button
              size="sm"
              variant="outline"
              className="relative mt-3"
              disabled={retry.isPending}
              onClick={() => retry.mutate()}
            >
              <RotateCw className={cn('size-4', retry.isPending && 'animate-spin')} />
              {retry.isPending ? 'Retrying' : 'Retry'}
            </Button>
          </>
        )}
      </CutoutCardContent>
    </CutoutCard>
  )
}

const renameSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name').max(200, 'Use 200 characters or fewer'),
})

function RenameProject({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const form = useForm<z.infer<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: project.name },
  })

  useEffect(() => form.reset({ name: project.name }), [form, project.name])

  const rename = useMutation({
    mutationFn: ({ name }: z.infer<typeof renameSchema>) => renameProjectFn({ data: { id: project.id, name } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: ({ name }) => {
      qc.invalidateQueries({ queryKey: qk.projects })
      qc.invalidateQueries({ queryKey: qk.project(project.id) })
      toast.success(`Renamed to ${name}`)
      setOpen(false)
    },
  })

  return (
    <>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="relative z-10 text-text-muted hover:text-foreground"
        aria-label={`Rename ${project.name}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-surface-1">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Choose a name that makes this edit easy to find later.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => rename.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor={`project-name-${project.id}`}>Project name</Label>
              <Input id={`project-name-${project.id}`} autoFocus {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-sm text-danger">{form.formState.errors.name.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={rename.isPending}>
                {rename.isPending ? 'Saving' : 'Save name'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** The ingest poster, or a placeholder for rows that predate it or failed. */
function Poster({ project: p }: { project: Project }) {
  if (!p.poster_url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Clapperboard className="size-8 text-muted-foreground" />
      </div>
    )
  }
  return <CutoutCardImage src={p.poster_url} alt="" className="object-contain" />
}
