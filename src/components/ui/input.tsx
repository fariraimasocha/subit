import * as React from 'react'
import { Input as KumoInput } from '@cloudflare/kumo/components/input'
import { cn } from '~/lib/utils'

function Input({ className, size: _htmlSize, ...props }: React.ComponentProps<'input'>) {
  return <KumoInput className={cn('w-full', className)} {...props} />
}

export { Input }
