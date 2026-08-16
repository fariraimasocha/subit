import { ArrowClockwise } from '@phosphor-icons/react'
import { ProgressBar } from '~/components/interior/progress-bar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { INGEST_STAGES, type IngestStage } from '~/lib/project.ts'
import { cn } from '~/lib/utils.ts'

type Props = {
  stage: IngestStage | null
  failed?: boolean
  error?: string | null
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/**
 * Same ProgressBar as the upload page. The old four-tile grid was getting
 * clipped by the editor column, and it did not match the upload loader.
 */
export function IngestProgress({
  stage,
  failed = false,
  error,
  onRetry,
  retrying,
  className,
}: Props) {
  const current = INGEST_STAGES.findIndex((s) => s.id === stage)
  const activeIdx = current < 0 ? 0 : current
  const label = failed
    ? 'Processing failed'
    : (INGEST_STAGES[activeIdx]?.label ?? 'Working on your video')
  const value = failed ? Math.round((activeIdx / INGEST_STAGES.length) * 100) : Math.round(((activeIdx + 0.45) / INGEST_STAGES.length) * 100)

  return (
    <div className={cn('shrink-0 rounded-2xl border border-border/40 bg-surface-2 p-5', className)}>
      <ProgressBar
        value={failed ? value : Math.min(96, Math.max(8, value))}
        label={label}
        pendingLabel="Starting"
        completeLabel="Ready"
      />
      <p className="mt-2 text-sm text-muted-foreground">
        {failed
          ? error || 'Something went wrong while preparing this video.'
          : 'This page updates itself. No need to reload.'}
      </p>
      {failed && onRetry ? (
        <Button variant="outline" className="mt-4" disabled={retrying} onClick={onRetry}>
          <ArrowClockwise className={cn('size-4', retrying && 'animate-spin')} />
          Retry
        </Button>
      ) : null}
    </div>
  )
}
