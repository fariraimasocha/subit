import { serve } from 'srvx'
// @ts-expect-error built artifact, only exists after `pnpm build`
import handler from './dist/server/server.js'

/**
 * The only runtime-specific file in the repo. `vite build` emits a plain
 * `{ fetch(request): Response }` module, which is already the Cloudflare /
 * Deno / Bun worker shape, so targeting Node means handing that same handler
 * to srvx. Nothing above this line knows which runtime it is on.
 *
 * ponytail: for Workers, point wrangler's `main` at dist/server/server.js and
 * delete nothing. For Vercel/Netlify, their adapter wraps the same export.
 */
serve({
  fetch: handler.fetch,
  port: Number(process.env.PORT ?? 3000),
})
