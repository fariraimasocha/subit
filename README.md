# SubIt

Subscription tracker. Built on TanStack Start to exercise one thing per route:
file-based routing, validated search params, loaders, typed server functions,
full-document SSR, and streaming.

```sh
pnpm dev        # http://localhost:3000
pnpm test       # node:test, no test framework
pnpm typecheck
pnpm build && pnpm start
```

## Routes and SSR modes

| Route | SSR mode | Why |
| --- | --- | --- |
| `/` | `true` | Public list, wants indexable HTML and instant first paint. |
| `/subs/$id` | `true` + streaming | Shell renders immediately, billing history streams in behind Suspense. |
| `/stats` | `'data-only'` | Loader runs on the server and the data ships in the document, markup renders on the client. Nothing here needs crawling. |
| `/settings` | `false` | Reads `localStorage`. Server-rendering it would produce markup wrong for every visitor. |

Streaming is easiest to see on `/subs/$id`: first byte in ~7ms with a skeleton,
history rows arrive ~1.2s later. Requests from crawlers get the fully buffered
document instead, which TanStack Start handles via `isbot` with no config.

## The server boundary

Two layers, both mechanical:

1. `vite.config.ts` sets `importProtection` so any client module importing
   `*.server.ts` is a **build error**, not a runtime surprise.
2. `src/server/db.server.ts` wraps its accessor in `createServerOnlyFn`, which
   throws if it is ever reached from the client anyway.

So the store is only reachable through `src/server/subs.ts`, where every export
is a `createServerFn` with a zod `validator`. Route loaders call those and get
full types back with no hand-written generics.

`src/schemas.ts` and `src/select.ts` are shared and client-safe on purpose: the
route's `validateSearch` and the server function's `validator` are built from the
same zod object.

They differ in how they fail, deliberately. The RPC payload is a trust boundary,
so `listSubs` parses strictly and rejects. The URL is user-editable navigation
state, so `/` degrades a bad param to its default: `?page=abc&q=spotify` keeps
the search term and resets the page rather than returning a 500. That is wired
through `listSearchValidator`, a Standard Schema wrapper, because the router
reads the declared *input* type to decide whether `<Link to="/">` may omit
`search` (zod's own `.catch()` widens that input to `unknown` and loses both the
autocomplete and the optionality).

## Deployment runtime

`vite build` emits `dist/server/server.js` with a default export of
`{ fetch(request): Response }`. That is the whole application, and it is already
the Cloudflare Workers / Deno / Bun module shape.

Targeting a runtime therefore means swapping the adapter, never the app:

- **Node** (default): `serve.ts` hands the same handler to `srvx`. `pnpm start`.
- **Cloudflare Workers**: point wrangler's `main` at `dist/server/server.js`.
  No adapter file, no app changes.
- **Vercel / Netlify**: their handler wraps the same `fetch` export.

`serve.ts` is the only runtime-specific file in the repo.

## Known simplifications

- Data lives in memory (`src/server/db.server.ts`), so edits reset on restart.
  Everything above `table()` is already async, so a real driver drops in without
  touching the routes.
- Mutations use `router.invalidate()` rather than TanStack Query. Loaders already
  own this data and a second cache would have to be kept in sync with the first.
- Plain CSS instead of shadcn/ui + Tailwind, and no `zustand` (there is no
  cross-route client state yet). Both are stack rules in `CLAUDE.md`, deliberately
  deferred rather than forgotten.
