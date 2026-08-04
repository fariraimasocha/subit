import { Check, Circle, Loader2 } from 'lucide-react'
import { INGEST_STAGES, type IngestStage } from '~/lib/project.ts'
import { cn } from '~/lib/utils.ts'

/**
 * Ingest is four slow steps behind one status. Showing which one is running
 * turns a spinner that could mean anything into something you can wait on, and
 * on failure the stage that stalled is most of the triage.
 */
export function IngestProgress({ stage, failed }: { stage: IngestStage | null; failed?: boolean }) {
  const current = INGEST_STAGES.findIndex((s) => s.id === stage)
  // No stage yet means the job has been queued but has not reported in.
  const activeIdx = current < 0 ? 0 : current

  return (
    <ol className="space-y-3">
      {INGEST_STAGES.map((s, i) => {
        const done = i < activeIdx
        const active = i === activeIdx
        return (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center">
              {done ? (
                <Check className="size-4 text-ok" />
              ) : active && failed ? (
                <Circle className="size-4 fill-destructive text-destructive" />
              ) : active ? (
                <Loader2 className="size-4 animate-spin text-foreground" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground/40" />
              )}
            </span>
            <span
              className={cn(
                done && 'text-muted-foreground',
                active && !failed && 'font-medium text-foreground',
                active && failed && 'font-medium text-destructive',
                !done && !active && 'text-muted-foreground/60',
              )}
            >
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
