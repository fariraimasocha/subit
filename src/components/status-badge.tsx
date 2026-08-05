import { AlertTriangle, Check, CircleCheck, Clock, Loader2 } from 'lucide-react'
import { Badge } from '~/components/ui/badge.tsx'
import type { ProjectStatus } from '~/lib/project.ts'
import { cn } from '~/lib/utils.ts'

/**
 * Icon plus label, never colour alone. The tint is the third signal, not the
 * first: read with the colour removed each row still says what it says, which
 * is the whole reason the icon is not decorative here.
 *
 * The tones are token pairs (fill at 15%, label at full) rather than palette
 * shades, so the label clears 4.5:1 on every surface. lib/contrast.test.ts
 * asserts that for --ok, --warn and --danger. No stroke: the tinted fill is the
 * shape, and an outlined pill on a poster read as a second card edge.
 */
const STATES: Record<
  ProjectStatus,
  { label: string; icon: React.ElementType; tone: string; spin?: boolean }
> = {
  uploaded: { label: 'Queued', icon: Clock, tone: 'bg-muted text-text-secondary' },
  processing: { label: 'Transcribing', icon: Loader2, tone: 'bg-brand/15 text-brand', spin: true },
  ready: { label: 'Ready', icon: CircleCheck, tone: 'bg-ok/15 text-ok' },
  exporting: { label: 'Exporting', icon: Loader2, tone: 'bg-brand/15 text-brand', spin: true },
  done: { label: 'Exported', icon: Check, tone: 'bg-ok/15 text-ok' },
  error: { label: 'Failed', icon: AlertTriangle, tone: 'bg-danger/15 text-danger' },
}

export function StatusBadge({
  status,
  /** Ingest or export percentage, appended to the label while work is running. */
  pct,
  className,
}: {
  status: ProjectStatus
  pct?: number | null
  className?: string
}) {
  const { label, icon: Icon, tone, spin } = STATES[status]
  const showPct = spin && typeof pct === 'number'

  return (
    <Badge
      className={cn(
        'gap-1.5 border-transparent py-1 font-mono tracking-wide uppercase',
        tone,
        className,
      )}
    >
      <Icon className={cn('size-3.5', spin && 'animate-spin')} aria-hidden />
      {label}
      {showPct && <span className="tabular-nums">{Math.round(pct)}%</span>}
    </Badge>
  )
}
