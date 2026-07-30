import { z } from 'zod'

/**
 * Shared between route `validateSearch` and the server functions, so a bad
 * search param and a bad RPC payload fail the same way with the same message.
 * Client-safe on purpose: no import of anything under src/server.
 */
export const statusFilter = z.enum(['all', 'active', 'paused', 'cancelled'])
export const sortKey = z.enum(['renewsAt', 'price', 'name'])

/** Strict, with defaults. This is what the server function validates against. */
export const listSearch = z.object({
  q: z.string().trim().max(60).default(''),
  status: statusFilter.default('all'),
  sort: sortKey.default('renewsAt'),
  page: z.coerce.number().int().min(1).max(999).default(1),
})

export type ListSearch = z.infer<typeof listSearch>

/** Every field has a default, so every field is optional in the URL. */
export type ListSearchInput = Partial<z.input<typeof listSearch>>

/**
 * The URL is not a trust boundary, it is user-editable navigation state, so a
 * stale or hand-mangled param should degrade to its default rather than 500 the
 * page. Only the fields that actually failed are dropped: a bad `page` must not
 * throw away a valid `q`. The server function still parses strictly, so nothing
 * unvalidated reaches a handler either way.
 */
export const parseListSearch = (input: ListSearchInput): ListSearch => {
  const first = listSearch.safeParse(input)
  if (first.success) return first.data

  const bad = new Set(first.error.issues.map((i) => String(i.path[0])))
  return listSearch.parse(
    Object.fromEntries(Object.entries(input).filter(([k]) => !bad.has(k))),
  )
}

/**
 * Handed to `validateSearch` as a Standard Schema rather than the zod object
 * directly. The router reads the declared input type to decide whether `<Link>`
 * may omit `search`, so this keeps `ListSearchInput` (every key optional, every
 * key typed) while routing the actual parse through the tolerant path above.
 * Zod's own `.catch()` would widen the input to `unknown` and lose that.
 */
export const listSearchValidator = {
  '~standard': {
    version: 1 as const,
    vendor: 'subit',
    validate: (value: unknown) => ({
      value: parseListSearch((value ?? {}) as ListSearchInput),
    }),
    types: undefined as unknown as { input: ListSearchInput; output: ListSearch },
  },
}

export const subId = z.object({ id: z.string().min(1).max(64) })

export const PAGE_SIZE = 4

export const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
