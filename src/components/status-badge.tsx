import { Badge } from '~/components/ui/badge.tsx'
import type { ProjectStatus } from '~/lib/project.ts'

const LABELS: Record<ProjectStatus, string> = {
  uploaded: 'Queued',
  processing: 'Transcribing',
  ready: 'Ready',
  exporting: 'Exporting',
  done: 'Exported',
  error: 'Failed',
}

const TONES: Record<ProjectStatus, string> = {
  uploaded: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
  processing: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  exporting: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  done: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  error: 'bg-red-500/15 text-red-300 border-red-500/30',
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant="outline" className={TONES[status]}>
      {LABELS[status]}
    </Badge>
  )
}
