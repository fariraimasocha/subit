import { LinkProvider } from '@cloudflare/kumo'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { useState } from 'react'
import { KumoRouterLink } from '~/components/kumo-link.tsx'
import { ToastProvider } from '~/components/providers/ToastProvider.tsx'
import styles from '~/globals.css?url'

const SITE_URL = 'https://subit.farirai.workers.dev'
const OG_IMAGE = `${SITE_URL}/og-image.png`

/**
 * Full-document SSR. `shellComponent` owns <html>, <head> and <body>, so the
 * server streams a real document and <HeadContent> picks up `head()` from
 * whichever route matched.
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Subit' },
      { name: 'description', content: 'Burn word by word captions into your videos.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_URL}/` },
      { property: 'og:title', content: 'Subit' },
      { property: 'og:description', content: 'Burn word by word captions into your videos.' },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Subit, burn word by word captions into your videos' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      // Chrome still fetches /favicon.ico even when an SVG is advertised. A
      // missing ico is a globe in the tab, which is what the first deploy showed.
      { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <p className="text-muted-foreground">That page does not exist.</p>
      <Link to="/dashboard" className="underline">
        Back to the dashboard
      </Link>
    </div>
  ),
})

function RootDocument() {
  // One QueryClient per browser session, created inside render so SSR never
  // shares a cache between requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // networkMode 'always' because the server is this machine. The default
          // 'online' parks a failed query in fetchStatus 'paused' whenever the
          // browser's online manager is unsure, so the UI sits on a skeleton
          // forever instead of ever showing the error.
          queries: { staleTime: 5_000, retry: 1, networkMode: 'always' },
          mutations: { networkMode: 'always' },
        },
      }),
  )
  return (
    <html lang="en" className="dark" data-mode="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <LinkProvider component={KumoRouterLink}>
            <Outlet />
            <ToastProvider />
          </LinkProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
