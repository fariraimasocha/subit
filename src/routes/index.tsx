import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { listSearchValidator, money, type ListSearch } from '~/schemas'
import { listSubs, setStatus } from '~/server/subs'

export const Route = createFileRoute('/')({
  // Streamed full-document SSR. This is the default, stated here because the
  // sibling routes deliberately pick something else.
  ssr: true,
  // Parsed and defaulted once, at the route, before the loader runs.
  // `Route.useSearch()` and `navigate({ search })` are both typed off the schema,
  // and a junk param like ?page=abc degrades to its default instead of erroring.
  validateSearch: listSearchValidator,
  // Only re-run the loader when a param the query actually uses changes.
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listSubs({ data: deps }),
  component: SubsList,
})

function SubsList() {
  const search = Route.useSearch()
  const { items, total, page, pages } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const update = useServerFn(setStatus)

  // Any filter change resets to page 1, otherwise you can land on an empty page.
  const patch = (next: Partial<ListSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...next, page: next.page ?? 1 }) })

  return (
    <>
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span className="dim">Search </span>
          <input
            type="search"
            defaultValue={search.q}
            placeholder="Name or vendor"
            aria-label="Search subscriptions"
            onChange={(e) => patch({ q: e.target.value })}
          />
        </label>
        <select
          value={search.status}
          aria-label="Filter by status"
          onChange={(e) => patch({ status: e.target.value as ListSearch['status'] })}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={search.sort}
          aria-label="Sort by"
          onChange={(e) => patch({ sort: e.target.value as ListSearch['sort'] })}
        >
          <option value="renewsAt">Renews soonest</option>
          <option value="price">Most expensive</option>
          <option value="name">Name</option>
        </select>
      </form>

      {items.length === 0 && <p className="panel dim">Nothing matches that filter.</p>}

      {items.map((sub) => (
        <article key={sub.id} className="panel">
          <div className="row">
            <div>
              <Link to="/subs/$id" params={{ id: sub.id }}>
                {sub.name}
              </Link>{' '}
              <span className="badge" data-s={sub.status}>
                {sub.status}
              </span>
              <div className="dim">
                {sub.vendor} &middot; renews {sub.renewsAt}
              </div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <span className="mono">
                {money(sub.priceCents)}
                <span className="dim">/{sub.cycle === 'yearly' ? 'yr' : 'mo'}</span>
              </span>
              <button
                onClick={async () => {
                  await update({
                    data: { id: sub.id, status: sub.status === 'active' ? 'paused' : 'active' },
                  })
                  // Re-runs the loaders for the current match, no second cache.
                  router.invalidate()
                }}
              >
                {sub.status === 'active' ? 'Pause' : 'Activate'}
              </button>
            </div>
          </div>
        </article>
      ))}

      <div className="row" style={{ marginTop: 16 }}>
        <span className="dim">
          {total} subscription{total === 1 ? '' : 's'} &middot; page {page} of {pages}
        </span>
        <span className="row" style={{ gap: 8 }}>
          <button disabled={page <= 1} onClick={() => patch({ page: page - 1 })}>
            Previous
          </button>
          <button disabled={page >= pages} onClick={() => patch({ page: page + 1 })}>
            Next
          </button>
        </span>
      </div>
    </>
  )
}
