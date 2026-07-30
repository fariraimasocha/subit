import { PAGE_SIZE, type ListSearch } from './schemas.ts'

/** Just the shape `select` needs, so this file stays free of any server import. */
export type Selectable = {
  name: string
  vendor: string
  status: 'active' | 'paused' | 'cancelled'
  priceCents: number
  cycle: 'monthly' | 'yearly'
  renewsAt: string
}

export const monthlyCents = (s: Pick<Selectable, 'priceCents' | 'cycle'>) =>
  s.cycle === 'yearly' ? s.priceCents / 12 : s.priceCents

/**
 * Pure filter + sort + paginate. Lives outside src/server so it can be tested
 * without booting the app, and so the server function stays a thin wrapper.
 */
export function select<T extends Selectable>(rows: Array<T>, search: ListSearch) {
  const q = search.q.toLowerCase()

  const matched = rows
    .filter((s) => (search.status === 'all' ? true : s.status === search.status))
    .filter((s) => !q || s.name.toLowerCase().includes(q) || s.vendor.toLowerCase().includes(q))
    .sort((a, b) =>
      search.sort === 'name'
        ? a.name.localeCompare(b.name)
        : search.sort === 'price'
          ? monthlyCents(b) - monthlyCents(a)
          : a.renewsAt.localeCompare(b.renewsAt),
    )

  const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE))
  // Clamp instead of returning an empty page when a filter shrinks the result set.
  const page = Math.min(search.page, pages)

  return {
    items: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: matched.length,
    page,
    pages,
  }
}
