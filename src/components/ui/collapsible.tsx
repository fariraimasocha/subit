import * as React from 'react'
import { Collapsible as KumoCollapsible } from '@cloudflare/kumo/components/collapsible'

function Collapsible(props: React.ComponentProps<typeof KumoCollapsible.Root>) {
  return <KumoCollapsible.Root {...props} />
}

function CollapsibleTrigger({
  asChild,
  children,
  ...props
}: React.ComponentProps<typeof KumoCollapsible.Trigger> & { asChild?: boolean }) {
  if (asChild && React.isValidElement(children)) {
    return <KumoCollapsible.Trigger render={children} {...props} />
  }
  return <KumoCollapsible.Trigger {...props}>{children}</KumoCollapsible.Trigger>
}

function CollapsibleContent(props: React.ComponentProps<typeof KumoCollapsible.Panel>) {
  return <KumoCollapsible.Panel {...props} />
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
