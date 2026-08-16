import * as React from 'react'
import { Badge as KumoBadge, type BadgeVariant as KumoBadgeVariant } from '@cloudflare/kumo/components/badge'
import { cn } from '~/lib/utils'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'

const variantMap: Record<Variant, KumoBadgeVariant> = {
  default: 'primary',
  secondary: 'secondary',
  destructive: 'error',
  outline: 'outline',
  ghost: 'neutral',
  link: 'info',
}

const variantClass: Record<Variant, string> = {
  default: '!bg-brand !text-brand-foreground',
  secondary: '!bg-surface-2 !text-foreground',
  destructive: '',
  outline: 'border-white/10 !text-text-secondary',
  ghost: '!text-foreground',
  link: '!text-brand',
}

function Badge({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'span'> & { variant?: Variant; asChild?: boolean }) {
  return (
    <KumoBadge variant={variantMap[variant]} className={cn(variantClass[variant], className)} {...props}>
      {children}
    </KumoBadge>
  )
}

export { Badge }
