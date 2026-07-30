import assert from 'node:assert/strict'
import test from 'node:test'
import { parseListSearch } from './schemas.ts'
import { select, type Selectable } from './select.ts'

const rows: Array<Selectable & { id: string }> = [
  { id: 'a', name: 'Alpha', vendor: 'Acme', status: 'active', priceCents: 100, cycle: 'monthly', renewsAt: '2026-09-01' },
  { id: 'b', name: 'Bravo', vendor: 'Acme', status: 'paused', priceCents: 2400, cycle: 'yearly', renewsAt: '2026-08-01' },
  { id: 'c', name: 'Cosmo', vendor: 'Zeta', status: 'active', priceCents: 500, cycle: 'monthly', renewsAt: '2026-10-01' },
  { id: 'd', name: 'Delta', vendor: 'Zeta', status: 'cancelled', priceCents: 900, cycle: 'monthly', renewsAt: '2026-07-01' },
  { id: 'e', name: 'Echo', vendor: 'Zeta', status: 'active', priceCents: 300, cycle: 'monthly', renewsAt: '2026-11-01' },
]

const search = (over: Record<string, unknown> = {}) =>
  parseListSearch(over as Parameters<typeof parseListSearch>[0])

test('search params default and coerce', () => {
  assert.deepEqual(search(), { q: '', status: 'all', sort: 'renewsAt', page: 1 })
  assert.equal(search({ page: '3' }).page, 3, 'numeric strings from the URL coerce')
})

test('a junk param degrades to its default without discarding the good ones', () => {
  // A bad `page` must not 500 the route, and must not throw away a valid `q`.
  assert.deepEqual(search({ page: 'abc', q: 'spotify' }), {
    q: 'spotify',
    status: 'all',
    sort: 'renewsAt',
    page: 1,
  })
  assert.equal(search({ page: 0 }).page, 1, 'out of range falls back')
  assert.equal(search({ status: 'archived' }).status, 'all')
  assert.deepEqual(search({ sort: 'nonsense', status: 'paused' }), {
    q: '',
    status: 'paused',
    sort: 'renewsAt',
    page: 1,
  })
})

test('status filter and text search', () => {
  assert.deepEqual(
    select(rows, search({ status: 'active' })).items.map((r) => r.id),
    ['a', 'c', 'e'],
  )
  // Matches vendor as well as name, case-insensitively.
  assert.deepEqual(
    select(rows, search({ q: 'ACME' })).items.map((r) => r.id),
    ['b', 'a'],
  )
})

test('sorts by normalised monthly price, not raw price', () => {
  // Bravo is 2400/yr = 200/mo, so it must rank below Cosmo (500/mo) and Echo (300/mo).
  assert.deepEqual(
    select(rows, search({ sort: 'price' })).items.map((r) => r.id),
    ['d', 'c', 'e', 'b'],
  )
})

test('paginates and clamps an out-of-range page', () => {
  const first = select(rows, search())
  assert.equal(first.total, 5)
  assert.equal(first.pages, 2)
  assert.equal(first.items.length, 4)

  assert.equal(select(rows, search({ page: 2 })).items.length, 1)
  // Asking past the end lands on the last real page instead of an empty one.
  const clamped = select(rows, search({ page: 99 }))
  assert.equal(clamped.page, 2)
  assert.equal(clamped.items.length, 1)
})

test('empty result set still reports one page', () => {
  const none = select(rows, search({ q: 'nothing-matches-this' }))
  assert.deepEqual(none.items, [])
  assert.equal(none.total, 0)
  assert.equal(none.pages, 1)
  assert.equal(none.page, 1)
})
