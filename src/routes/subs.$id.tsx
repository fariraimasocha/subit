import { Await, createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'
import { money } from '~/schemas'
import { getSub, getSubHistory } from '~/server/subs'

export const Route = createFileRoute('/subs/$id')({
  ssr: true,
  loader: async ({ params }) => ({
    // Awaited: the shell needs it, so the document waits for it.
    sub: await getSub({ data: { id: params.id } }),
    // Not awaited: the promise is serialized to the client and resolved into the
    // stream later, so a slow query never holds up first paint.
    history: getSubHistory({ data: { id: params.id } }),
  }),
  component: SubDetail,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.sub.name} | SubIt` : 'SubIt' }],
  }),
})

function SubDetail() {
  const { sub, history } = Route.useLoaderData()

  return (
    <>
      <p className="dim">
        <Link to="/">Back to the list</Link>
      </p>

      <article className="panel">
        <div className="row">
          <h2 style={{ margin: 0, fontSize: 18 }}>{sub.name}</h2>
          <span className="badge" data-s={sub.status}>
            {sub.status}
          </span>
        </div>
        <p className="dim" style={{ margin: '6px 0 0' }}>
          {sub.vendor} &middot; {money(sub.priceCents)} per{' '}
          {sub.cycle === 'yearly' ? 'year' : 'month'} &middot; renews {sub.renewsAt}
        </p>
        <p style={{ marginBottom: 0 }}>{sub.notes}</p>
      </article>

      <section className="panel">
        <h3 style={{ margin: '0 0 10px', fontSize: 14 }}>Billing history</h3>
        <Suspense fallback={<HistorySkeleton />}>
          <Await promise={history}>
            {(rows) => (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {rows.map((r) => (
                  <li key={r.month} className="mono">
                    {r.month} &middot; {money(r.chargedCents)}
                  </li>
                ))}
              </ul>
            )}
          </Await>
        </Suspense>
      </section>
    </>
  )
}

function HistorySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading billing history">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton" style={{ width: `${70 - i * 8}%` }} />
      ))}
    </div>
  )
}
