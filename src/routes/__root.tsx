import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { useState } from 'react'
import { ToastProvider } from '~/components/providers/ToastProvider.tsx'
import styles from '~/globals.css?url'

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
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      // One SVG, no .ico: the tile carries its own background, so it reads on
      // both light and dark tab bars at every size.
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
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <ToastProvider />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
