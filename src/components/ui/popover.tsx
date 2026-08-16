import * as React from 'react'
import {
  PopoverRoot,
  PopoverTrigger as KumoPopoverTrigger,
  PopoverContent as KumoPopoverContent,
} from '@cloudflare/kumo/components/popover'
import { cn } from '~/lib/utils'

function Popover(props: React.ComponentProps<typeof PopoverRoot>) {
  return <PopoverRoot {...props} />
}

function PopoverTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof KumoPopoverTrigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <KumoPopoverTrigger render={children} {...props} />
  }
  return <KumoPopoverTrigger {...props}>{children}</KumoPopoverTrigger>
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof KumoPopoverContent>) {
  return (
    <KumoPopoverContent
      align={align}
      sideOffset={sideOffset}
      className={cn('w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md', className)}
      {...props}
    />
  )
}

function PopoverAnchor(props: React.ComponentProps<'div'>) {
  return <div {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 text-sm', className)} {...props} />
}

function PopoverTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('font-medium', className)} {...props} />
}

function PopoverDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-muted-foreground', className)} {...props} />
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
