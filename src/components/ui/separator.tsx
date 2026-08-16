import { Separator as KumoSeparator } from '@cloudflare/kumo/primitives/separator'
import { cn } from '~/lib/utils'

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof KumoSeparator>) {
  return (
    <KumoSeparator
      orientation={orientation}
      className={cn('bg-border', className)}
      {...props}
    />
  )
}

export { Separator }
