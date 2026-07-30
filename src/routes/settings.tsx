import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/settings')({
  // ssr: false means no server render and no loader on the server. This page only
  // reads localStorage, so rendering it on the server would produce markup that
  // is wrong for every visitor and then hydrate over itself.
  ssr: false,
  head: () => ({ meta: [{ title: 'Settings | SubIt' }] }),
  component: Settings,
})

const KEY = 'subit:currency'

function Settings() {
  const [currency, setCurrency] = useState('USD')

  useEffect(() => {
    const saved = localStorage.getItem(KEY)
    if (saved) setCurrency(saved)
  }, [])

  return (
    <section className="panel">
      <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Settings</h2>
      <p className="dim" style={{ marginTop: 0 }}>
        Stored in this browser only. Nothing here touches the server.
      </p>
      <label>
        <span className="dim">Display currency </span>
        <select
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value)
            localStorage.setItem(KEY, e.target.value)
          }}
        >
          {['USD', 'EUR', 'GBP', 'ZAR'].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <p className="dim" style={{ marginBottom: 0 }}>
        Formatting still renders in USD, this only records the preference.
      </p>
    </section>
  )
}
