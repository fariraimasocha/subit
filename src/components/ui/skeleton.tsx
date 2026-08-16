import { cn } from '~/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-kumo-fill', className)} {...props} />
}

export { Skeleton }
