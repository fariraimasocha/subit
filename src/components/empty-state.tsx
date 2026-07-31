import type { LucideIcon } from 'lucide-react'
import { cn } from '~/lib/utils.ts'

/**
 * An empty state is the first thing a new user sees, so it explains the feature
 * rather than reporting the absence of rows. The caller is expected to hide the
 * surrounding chrome (table headers, sort, pagination) when rendering this:
 * controls for content that does not exist read as a broken page.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // A tinted panel and generous space separate this from the page without
        // a border, and the dotted edge reads as "space for something" rather
        // than as a container.
        'flex flex-col items-center rounded-xl border border-dashed bg-muted/30 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
        <Icon className="size-5" />
      </span>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-balance text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
