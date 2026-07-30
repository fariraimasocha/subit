import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { listSearch, subId } from '~/schemas'
import { monthlyCents, select } from '~/select'
import { table, sleep } from './db.server'

/**
 * The only door between client and server. Every export here is an RPC whose
 * input is parsed by zod before the handler runs, and whose return type flows
 * back to the caller, so route loaders stay fully typed with no manual generics.
 */

export const listSubs = createServerFn({ method: 'GET' })
  .validator(listSearch)
  .handler(async ({ data }) => select(table(), data))

export const getSub = createServerFn({ method: 'GET' })
  .validator(subId)
  .handler(async ({ data }) => {
    const sub = table().find((s) => s.id === data.id)
    if (!sub) throw notFound()
    return sub
  })

/**
 * Deliberately slow. The detail route streams this in behind Suspense instead of
 * making the whole document wait on it.
 */
export const getSubHistory = createServerFn({ method: 'GET' })
  .validator(subId)
  .handler(async ({ data }) => {
    await sleep(1200)
    const sub = table().find((s) => s.id === data.id)
    if (!sub) throw notFound()
    return Array.from({ length: 6 }, (_, i) => ({
      month: new Date(2026, 6 - i, 1).toISOString().slice(0, 7),
      chargedCents: sub.priceCents,
    }))
  })

export const getStats = createServerFn({ method: 'GET' }).handler(async () => {
  const all = table()
  const active = all.filter((s) => s.status === 'active')
  return {
    count: all.length,
    activeCount: active.length,
    monthlyCents: Math.round(active.reduce((sum, s) => sum + monthlyCents(s), 0)),
    byVendor: active
      .map((s) => ({ vendor: s.vendor, monthlyCents: Math.round(monthlyCents(s)) }))
      .sort((a, b) => b.monthlyCents - a.monthlyCents),
  }
})

export const setStatus = createServerFn({ method: 'POST' })
  .validator(subId.extend({ status: z.enum(['active', 'paused', 'cancelled']) }))
  .handler(async ({ data }) => {
    const sub = table().find((s) => s.id === data.id)
    if (!sub) throw notFound()
    sub.status = data.status
    return sub
  })
