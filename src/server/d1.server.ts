import type { Cue } from '~/lib/cues.ts'
import type { Overlay } from '~/lib/overlays.ts'
import type { Project, ProjectRow } from '~/lib/project.ts'
import type { Theme } from '~/lib/theme.ts'

export type { Project, ProjectRow, ProjectStatus } from '~/lib/project.ts'

/**
 * D1 over the HTTP API, not a binding, because this app is a long-lived Node
 * process rather than a Worker. That is a direct consequence of choosing native
 * ffmpeg for rendering.
 *
 * ponytail: no migration runner. Schema changes are a manual ALTER TABLE or
 * `wrangler d1 execute`. Auth tables live in schema/better-auth.sql. Projects
 * table is in PLAN.md.
 */
const queryUrl = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`

export function d1Configured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.D1_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN,
  )
}

export type D1QueryMeta = {
  changes?: number
  last_row_id?: number
  duration?: number
}

export type D1QueryResult<T = Record<string, unknown>> = {
  results: T[]
  meta: D1QueryMeta
  success: true
}

export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<D1QueryResult<T>> {
  if (!d1Configured()) {
    throw new Error(
      'D1 is not configured. Set CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_ID and CLOUDFLARE_API_TOKEN in .env.local',
    )
  }
  const res = await fetch(queryUrl(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  const json = (await res.json()) as {
    success?: boolean
    errors?: { message?: string }[]
    result?: { results?: T[]; meta?: D1QueryMeta; success?: boolean }[]
  }
  if (!res.ok || !json.success) throw new Error(json.errors?.[0]?.message ?? `D1 ${res.status}`)
  const first = json.result?.[0]
  return {
    results: (first?.results ?? []) as T[],
    meta: first?.meta ?? {},
    success: true,
  }
}

export async function d1<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const { results } = await d1Query<T>(sql, params)
  return results
}

export function hydrate(row: ProjectRow): Project {
  const { cues_json, theme_json, overlays_json, ...rest } = row
  return {
    ...rest,
    cues: cues_json ? (JSON.parse(cues_json) as Cue[]) : [],
    theme: theme_json ? (JSON.parse(theme_json) as Theme) : null,
    overlays: overlays_json ? (JSON.parse(overlays_json) as Overlay[]) : [],
  }
}

export async function createProject(id: string, name: string, srcKey: string, userId: string) {
  await d1(
    `INSERT INTO projects (id, name, status, user_id, src_key, created_at) VALUES (?, ?, 'uploaded', ?, ?, ?)`,
    [id, name, userId, srcKey, Date.now()],
  )
}

export async function listProjects(userId: string) {
  const rows = await d1<ProjectRow>(
    `SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
    [userId],
  )
  return rows.map(hydrate)
}

export async function getProject(id: string, userId: string) {
  const rows = await d1<ProjectRow>(
    `SELECT * FROM projects WHERE id = ? AND user_id = ?`,
    [id, userId],
  )
  return rows[0] ? hydrate(rows[0]) : null
}

/** Internal lookup without user scoping, for background jobs (ingest/export). */
export async function getProjectInternal(id: string) {
  const rows = await d1<ProjectRow>(`SELECT * FROM projects WHERE id = ?`, [id])
  return rows[0] ? hydrate(rows[0]) : null
}

/** Partial update over the raw column names. Only the keys present are written. */
export async function updateProject(id: string, patch: Partial<ProjectRow>) {
  const keys = Object.keys(patch).filter((k) => k !== 'id') as (keyof ProjectRow)[]
  if (keys.length === 0) return
  const set = keys.map((k) => `${k} = ?`).join(', ')
  await d1(`UPDATE projects SET ${set} WHERE id = ?`, [...keys.map((k) => patch[k] ?? null), id])
}

export async function deleteProject(id: string) {
  await d1(`DELETE FROM projects WHERE id = ?`, [id])
}
