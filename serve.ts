import { serve } from 'srvx'
import { serveStatic } from 'srvx/static'
// @ts-expect-error built artifact, only exists after `pnpm build`
import handler from './dist/server/server.js'

/**
 * Vite writes hashed CSS/JS and a copy of `public/` into dist/client. The
 * TanStack Start fetch handler only does SSR, so without this middleware a
 * production host (the Cloudflare container included) returns HTML 404s for
 * `/assets/*.css` and the page renders as unstyled markup.
 *
 * Extensionless paths stay with the SSR handler so `/` and `/dashboard` are
 * never hijacked by a generated index.html.
 */
const clientFiles = serveStatic({ dir: './dist/client' })

serve({
  middleware: [
    (req, next) => {
      const path = new URL(req.url).pathname
      if (!/\.[a-z0-9]+$/i.test(path) || path.endsWith('.html')) return next()
      return clientFiles(req, next)
    },
  ],
  fetch: handler.fetch,
  port: Number(process.env.PORT ?? 3000),
})
