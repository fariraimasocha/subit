import { AlertTriangle, Check, CircleCheck, Clock, Loader2 } from 'lucide-react'
import { Badge } from '~/components/ui/badge.tsx'
import type { ProjectStatus } from '~/lib/project.ts'
import { cn } from '~/lib/utils.ts'

/**
 * Icon plus label, never colour alone. The tint is the third signal, not the
 * first: read with the colour removed each row still says what it says, which
 * is the whole reason the icon is not decorative here.
 *
 * The tones are token pairs (fill at 12%, label at full) rather than palette
 * shades, so the label clears 4.5:1 on every surface. lib/contrast.test.ts
 * asserts that for --ok, --warn and --danger.
 */
const STATES: Record<
  ProjectStatus,
  { label: string; icon: React.ElementType; tone: string; spin?: boolean }
> = {
  uploaded: { label: 'Queued', icon: Clock, tone: 'bg-muted text-text-secondary border-border' },
  processing: {
    label: 'Transcribing',
    icon: Loader2,
    tone: 'bg-brand/12 text-brand border-brand/40',
    spin: true,
  },
  ready: { label: 'Ready', icon: CircleCheck, tone: 'bg-ok/12 text-ok border-ok/40' },
  exporting: {
    label: 'Exporting',
    icon: Loader2,
    tone: 'bg-brand/12 text-brand border-brand/40',
    spin: true,
  },
  done: { label: 'Exported', icon: Check, tone: 'bg-ok/12 text-ok border-ok/40' },
  error: { label: 'Failed', icon: AlertTriangle, tone: 'bg-danger/12 text-danger border-danger/40' },
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
    <Badge variant="outline" className={cn('gap-1.5 py-1', tone, className)}>
      <Icon className={cn('size-3.5', spin && 'animate-spin')} aria-hidden />
      {label}
      {showPct && <span className="tabular-nums">{Math.round(pct)}%</span>}
    </Badge>
  )
}
