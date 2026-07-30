import { createFileRoute } from '@tanstack/react-router'
import { money } from '~/schemas'
import { getStats } from '~/server/subs'

export const Route = createFileRoute('/stats')({
  // 'data-only': the loader still runs on the server and its result is embedded
  // in the document, but the markup is rendered on the client. Right trade-off
  // for a page whose HTML nobody needs to crawl and whose data is not public.
  ssr: 'data-only',
  head: () => ({ meta: [{ title: 'Stats | SubIt' }] }),
  loader: () => getStats(),
  component: Stats,
})

function Stats() {
  const { count, activeCount, monthlyCents, byVendor } = Route.useLoaderData()
  const max = Math.max(1, ...byVendor.map((v) => v.monthlyCents))

  return (
    <>
      <div className="panel row">
        <div>
          <div className="dim">Monthly spend, active only</div>
          <strong className="mono" style={{ fontSize: 26 }}>
            {money(monthlyCents)}
          </strong>
        </div>
        <div className="dim mono">
          {activeCount} active of {count}
        </div>
      </div>

      <section className="panel">
        <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>By vendor, per month</h3>
        {byVendor.map((v) => (
          <div key={v.vendor} style={{ marginBottom: 10 }}>
            <div className="row">
              <span>{v.vendor}</span>
              <span className="mono dim">{money(v.monthlyCents)}</span>
            </div>
            <div className="bar" style={{ width: `${(v.monthlyCents / max) * 100}%` }} />
          </div>
        ))}
      </section>
    </>
  )
}
