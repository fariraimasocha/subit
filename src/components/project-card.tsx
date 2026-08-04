import { Link } from '@tanstack/react-router'
import { Clapperboard, ImageIcon, Pencil, Type } from 'lucide-react'
import { StatusBadge } from '~/components/status-badge.tsx'
import { Button } from '~/components/ui/button.tsx'
import {
  CutoutCard,
  CutoutCardAction,
  CutoutCardContent,
  CutoutCardImage,
  CutoutCardInsetLabel,
  CutoutCardMedia,
  CutoutCardOverlay,
  CutoutCardPin,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from '~/components/ui/cutout-card.tsx'
import {
  ExpandableScreen,
  ExpandableScreenContent,
  ExpandableScreenTrigger,
} from '~/components/ui/expandable-screen.tsx'
import type { Project } from '~/lib/project.ts'
import { cn } from '~/lib/utils.ts'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** m:ss, the same shape the projects table uses. */
function length(sec: number | null) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}`
}

/**
 * A project as a cult-ui CutoutCard that expands in place. The card itself is
 * not a link: clicking expands it, and the expanded panel is what carries the
 * actions. Everything visible on the collapsed card is already in the list
 * query, so opening one costs no request.
 */
export function ProjectCard({ project: p }: { project: Project }) {
  const meta = [
    new Date(p.created_at).toLocaleDateString(),
    p.cues.length ? plural(p.cues.length, 'cue') : null,
    p.overlays.length ? plural(p.overlays.length, 'image') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ExpandableScreen layoutId={`project-${p.id}`} contentRadius="24px" triggerRadius="28px">
      {/* block!, because the trigger ships as inline-block and would otherwise
          shrink to its content inside the grid cell. */}
      <ExpandableScreenTrigger className="block! w-full">
        <CutoutCard className={cn(cutoutCardSurfaceClassName, 'w-full')}>
          <CutoutCardMedia className="aspect-video w-full bg-muted">
            <Poster project={p} />
            <CutoutCardOverlay />

            {/* Length, cut into the top right corner. */}
            {length(p.duration) && (
              <CutoutCardPin className="top-0 right-0 rounded-bl-[18px] bg-card px-3 py-1.5 text-xs font-medium tabular-nums">
                {length(p.duration)}
                <CutoutCorner className="absolute top-0 -left-4 text-card" size={16} />
                <CutoutCorner
                  className="absolute -bottom-4 right-0 rotate-180 text-card"
                  size={16}
                />
              </CutoutCardPin>
            )}

            <CutoutCardInsetLabel className="bottom-3 left-3">
              <StatusBadge status={p.status} />
            </CutoutCardInsetLabel>

            <CutoutCardAction className="right-3 bottom-3">
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                Open
              </span>
            </CutoutCardAction>
          </CutoutCardMedia>

          <CutoutCardContent className="p-4">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
          </CutoutCardContent>
        </CutoutCard>
      </ExpandableScreenTrigger>

      <ExpandableScreenContent className="mx-auto max-w-3xl border bg-card shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="overflow-hidden rounded-2xl bg-muted">
            <div className="relative aspect-video w-full">
              <Poster project={p} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Clapperboard} label="Length" value={length(p.duration) ?? 'unknown'} />
            <Fact
              icon={Type}
              label="Cues"
              value={p.cues.length ? String(p.cues.length) : 'none yet'}
            />
            <Fact icon={ImageIcon} label="Images" value={String(p.overlays.length)} />
            <Fact
              icon={Pencil}
              label="Frame"
              value={p.width && p.height ? `${p.width}x${p.height}` : 'unknown'}
            />
          </dl>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link to="/editor/$id" params={{ id: p.id }}>
                Open editor
              </Link>
            </Button>
          </div>
        </div>
      </ExpandableScreenContent>
    </ExpandableScreen>
  )
}

/** The ingest poster, or a placeholder for rows that predate it or failed. */
function Poster({ project: p }: { project: Project }) {
  if (!p.poster_url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted">
        <Clapperboard className="size-8 text-muted-foreground" />
      </div>
    )
  }
  return <CutoutCardImage src={p.poster_url} alt="" />
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
    </div>
  )
}
