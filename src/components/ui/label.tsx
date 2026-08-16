import * as React from 'react'
import { Label as KumoLabel } from '@cloudflare/kumo/components/label'
import { cn } from '~/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof KumoLabel>) {
  return <KumoLabel className={cn(className)} {...props} />
}

export { Label }
