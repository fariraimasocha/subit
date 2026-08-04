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
 * ponytail: no migration runner. Schema changes are a manual ALTER TABLE in the
 * D1 console. See PLAN.md for the one CREATE TABLE this app needs.
 */
const queryUrl = () =>
  `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`

export function d1Configured() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && process.env.D1_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN,
  )
}

export async function d1<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
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
    // The REST API binds params loosely and lets SQLite column affinity coerce,
    // so do not .map(String) these.
    body: JSON.stringify({ sql, params }),
  })
  const json = (await res.json()) as any
  if (!res.ok || !json.success) throw new Error(json?.errors?.[0]?.message ?? `D1 ${res.status}`)
  return (json.result[0]?.results ?? []) as T[]
}

export function hydrate(row: ProjectRow): Project {
  const { cues_json, theme_json, overlays_json, ...rest } = row
  return {
    ...rest,
    cues: cues_json ? (JSON.parse(cues_json) as Cue[]) : [],
    theme: theme_json ? (JSON.parse(theme_json) as Theme) : null,
    // Null for every project that predates the column, hence the default rather
    // than a NOT NULL migration.
    overlays: overlays_json ? (JSON.parse(overlays_json) as Overlay[]) : [],
  }
}

export async function createProject(id: string, name: string, srcKey: string) {
  await d1(
    `INSERT INTO projects (id, name, status, src_key, created_at) VALUES (?, ?, 'uploaded', ?, ?)`,
    [id, name, srcKey, Date.now()],
  )
}

export async function listProjects() {
  const rows = await d1<ProjectRow>(`SELECT * FROM projects ORDER BY created_at DESC LIMIT 200`)
  return rows.map(hydrate)
}

export async function getProject(id: string) {
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
