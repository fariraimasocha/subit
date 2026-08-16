import { Link as RouterLink, type LinkProps } from '@tanstack/react-router'
import { forwardRef } from 'react'
import type { LinkComponentProps } from '@cloudflare/kumo'

/** Bridges Kumo `href` to TanStack Router `to` for LinkProvider. */
export const KumoRouterLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ href, children, ...rest }, ref) => (
    <RouterLink ref={ref} to={(href ?? '/') as LinkProps['to']} {...(rest as Omit<LinkProps, 'to' | 'children'>)}>
      {children}
    </RouterLink>
  ),
)
KumoRouterLink.displayName = 'KumoRouterLink'
