import { createServerOnlyFn } from '@tanstack/react-start'

// ponytail: in-memory store, swap the body of `table()` for a real driver when
// data needs to outlive the process. Everything above it is already async.
export type Sub = {
  id: string
  name: string
  vendor: string
  priceCents: number
  cycle: 'monthly' | 'yearly'
  status: 'active' | 'paused' | 'cancelled'
  renewsAt: string
  notes: string
}

const seed: Sub[] = [
  { id: 'netflix', name: 'Netflix', vendor: 'Netflix Inc', priceCents: 1599, cycle: 'monthly', status: 'active', renewsAt: '2026-08-12', notes: 'Family plan, 4 screens.' },
  { id: 'spotify', name: 'Spotify', vendor: 'Spotify AB', priceCents: 1199, cycle: 'monthly', status: 'active', renewsAt: '2026-08-03', notes: 'Duo plan, split with Tari.' },
  { id: 'figma', name: 'Figma', vendor: 'Figma Inc', priceCents: 1500, cycle: 'monthly', status: 'paused', renewsAt: '2026-09-01', notes: 'Paused until the redesign starts.' },
  { id: 'github', name: 'GitHub Pro', vendor: 'GitHub', priceCents: 4800, cycle: 'yearly', status: 'active', renewsAt: '2027-01-19', notes: 'Annual, cheaper than monthly.' },
  { id: 'notion', name: 'Notion', vendor: 'Notion Labs', priceCents: 1000, cycle: 'monthly', status: 'cancelled', renewsAt: '2026-07-01', notes: 'Moved notes to Obsidian.' },
  { id: 'vercel', name: 'Vercel Pro', vendor: 'Vercel', priceCents: 2000, cycle: 'monthly', status: 'active', renewsAt: '2026-08-22', notes: 'Covers all side projects.' },
  { id: 'icloud', name: 'iCloud+ 2TB', vendor: 'Apple', priceCents: 999, cycle: 'monthly', status: 'active', renewsAt: '2026-08-08', notes: 'Photos + backups.' },
  { id: 'claude', name: 'Claude Max', vendor: 'Anthropic', priceCents: 10000, cycle: 'monthly', status: 'active', renewsAt: '2026-08-15', notes: 'Pays for itself.' },
]

/**
 * Second half of the server boundary. `importProtection` in vite.config.ts fails
 * the build if a client module imports this file; `createServerOnlyFn` throws at
 * runtime if it somehow slips through anyway.
 */
export const table = createServerOnlyFn(() => seed)

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
