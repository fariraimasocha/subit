import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import type { Cue } from '~/lib/cues.ts'
import { isImageOverlay, type Overlay } from '~/lib/overlays.ts'
import type { Theme } from '~/lib/theme.ts'
import { createProject, deleteProject, getProject, listProjects } from './d1.server.ts'
import type { Project } from '~/lib/project.ts'
import { jobs, runExport, runIngest } from './jobs.server.ts'
import { agentLog, agentLogAuth, agentLogD8 } from './debug-log.server.ts'
import {
  buildKey,
  deleteObject,
  exportKeyOf,
  keyOf,
  presignDownloadUrl,
  presignPutUrl,
  publicUrl,
  r2Configured,
} from './r2.server.ts'
import { d1Configured } from './d1.server.ts'
import { groqConfigured } from './groq.server.ts'
import { updateProject } from './d1.server.ts'
import { auth } from '~/lib/auth.ts'

async function requireUserId(): Promise<string> {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) throw new Error('Unauthorized')
  return session.user.id
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
/** An overlay is a logo or a sticker, not a source video. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp']

/**
 * Star count for the landing page.
 *
 * Cached in memory because unauthenticated GitHub allows 60 requests an hour
 * per IP, and a landing page that fetched on every view would rate-limit itself
 * within a minute of any traffic. Failure is not an error worth showing: the
 * link still works without a number next to it.
 *
 * ponytail: module-level cache, same ceiling as the jobs Map. Set GITHUB_REPO
 * to point it somewhere else.
 */
const STARS_TTL_MS = 10 * 60 * 1000
/**
 * Failures get their own, much shorter window. Caching a miss for the full ten
 * minutes means one flaky request, or a fetch that lost a race with server
 * startup, blanks the count on every view for the rest of that window.
 */
const STARS_FAIL_TTL_MS = 30 * 1000
let starsCache: { at: number; count: number | null } | null = null

export const getStars = createServerFn({ method: 'GET' }).handler(async () => {
  const repo = process.env.GITHUB_REPO || 'fariraimasocha/subit'
  const ttl = starsCache?.count === null ? STARS_FAIL_TTL_MS : STARS_TTL_MS
  if (starsCache && Date.now() - starsCache.at < ttl) {
    return { repo, count: starsCache.count }
  }
  let count: number | null = null
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'subit',
        // Lifts the limit to 5000/hour when a token happens to be around.
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) count = (await res.json() as { stargazers_count?: number }).stargazers_count ?? null
    // A silently missing count is indistinguishable from a wrong GITHUB_REPO,
    // so say which one it was. Still not an error: the link renders regardless.
    else console.warn(`[stars] GitHub returned ${res.status} for ${repo}`)
  } catch (e) {
    console.warn(`[stars] could not reach GitHub for ${repo}:`, (e as Error).message)
    count = null
  }
  // Cache misses too, so a 404 or an outage does not retry on every render,
  // but only for STARS_FAIL_TTL_MS.
  starsCache = { at: Date.now(), count }
  return { repo, count }
})

const wordSchema = z.object({ text: z.string(), start: z.number(), end: z.number() })
const cueSchema = z.object({
  id: z.string(),
  start: z.number(),
  end: z.number(),
  words: z.array(wordSchema),
})
const themeSchema = z.object({
  id: z.string(),
  name: z.string(),
  fontFamily: z.string(),
  fontFile: z.string(),
  weight: z.number(),
  uppercase: z.boolean(),
  fontSizePct: z.number(),
  positionPct: z.number(),
  outlinePct: z.number(),
  shadowPct: z.number(),
  letterSpacingEm: z.number(),
  primary: z.string(),
  highlight: z.string(),
  outline: z.string(),
  boxColor: z.string().nullable(),
  highlightMode: z.enum(['color', 'none']),
})

/** What the dashboard shows before anything can work. */
export const getConfig = createServerFn({ method: 'GET' }).handler(async () => ({
  r2: r2Configured(),
  d1: d1Configured(),
  groq: groqConfigured(),
}))

/**
 * Keys this process handed out and has not seen claimed yet, so the failed
 * insert cleanup can only ever delete an object it just issued. Without this,
 * srcKey is caller controlled: during a D1 outage every createProjectFn call
 * throws, and someone could pass the key of a finished export and have the
 * server delete it for them.
 *
 * ponytail: in-memory, same ceiling as the jobs Map. A restart forgets the
 * pending keys, which only costs a leaked orphan object, never a wrong delete.
 */
const issuedKeys = new Map<string, number>()
const KEY_TTL_MS = 60 * 60 * 1000

function rememberKey(key: string) {
  const cutoff = Date.now() - KEY_TTL_MS
  for (const [k, t] of issuedKeys) if (t < cutoff) issuedKeys.delete(k)
  issuedKeys.set(key, Date.now())
}

/**
 * True only once per key, so a key cannot be replayed to force a second delete.
 * Expiry is enforced here rather than left to the next rememberKey call, or a
 * quiet server would keep hour-old keys claimable indefinitely.
 */
function claimKey(key: string) {
  const issued = issuedKeys.get(key)
  if (issued === undefined) return false
  issuedKeys.delete(key)
  return Date.now() - issued < KEY_TTL_MS
}

export const presign = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
      kind: z.enum(['video', 'image']).default('video'),
    }),
  )
  .handler(async ({ data }) => {
    const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'mp4'
    if (data.kind === 'image') {
      if (!IMAGE_EXTS.includes(ext)) throw new Error('Images must be PNG, JPG or WebP')
      if (data.size > MAX_IMAGE_BYTES) throw new Error('That image is over 10 MB')
      const key = buildKey('overlay', ext)
      // getUrl comes back with the PUT so the preview can show the image the
      // moment it lands, without a round trip through the project row.
      return {
        key,
        url: await presignPutUrl(key, data.contentType, data.size),
        getUrl: await publicUrl(key),
      }
    }
    if (!['mp4', 'mov'].includes(ext)) throw new Error('Only MP4 and MOV files are supported')
    const key = buildKey('src', ext)
    const url = await presignPutUrl(key, data.contentType, data.size)
    rememberKey(key)
    return { key, url, getUrl: null as string | null }
  })

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().min(1).max(200), srcKey: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const id = crypto.randomUUID()
    const ours = claimKey(data.srcKey)
    try {
      await createProject(id, data.name, data.srcKey, userId)
    } catch (e) {
      if (ours) await deleteObject(data.srcKey).catch(() => {})
      throw e
    }
    void runIngest(id)
    return { id }
  })

export const listProjectsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Project[]> => {
  const started = Date.now()
  // #region agent log
  agentLogAuth({
    runId: 'freeze-2',
    hypothesisId: 'N',
    location: 'api.ts:listProjectsFn',
    message: 'listProjects start',
  })
  // #endregion
  const userId = await requireUserId()
  const rows = await listProjects(userId)
  // #region agent log
  agentLogAuth({
    runId: 'freeze-2',
    hypothesisId: 'N',
    location: 'api.ts:listProjectsFn',
    message: 'listProjects end',
    data: { count: rows.length, ms: Date.now() - started },
  })
  // #endregion
  // #region agent log
  agentLogD8({
    location: 'api.ts:listProjectsFn',
    message: 'projects page data loaded',
    hypothesisId: 'F',
    runId: 'post-fix-4',
    data: { count: rows.length },
  })
  // #endregion
  return rows
})

export const getProjectFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<Project | null> => {
    const userId = await requireUserId()
    return getProject(data.id, userId)
  })

export const saveCues = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), cues: z.array(cueSchema) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    if (!project) throw new Error('Project not found')
    await updateProject(data.id, { cues_json: JSON.stringify(data.cues as Cue[]) })
    return { ok: true }
  })

/**
 * The key is the one field the export actually reads from the bucket, so it is
 * pinned to the shape buildKey('overlay', ext) produces. Without this a caller
 * could name any object in the bucket and have the server burn it into a video.
 */
const overlayBase = {
  id: z.string().min(1),
  name: z.string().max(200),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  xPct: z.number(),
  yPct: z.number(),
  widthPct: z.number(),
}

const overlaySchema = z.union([
  z.object({
    ...overlayBase,
    kind: z.literal('text'),
    text: z.string().trim().min(1).max(200),
    fontFamily: z.string().min(1).max(80),
    fontFile: z.string().regex(/^[A-Za-z0-9.-]+\.ttf$/),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    fontSizePct: z.number().min(1).max(20),
  }),
  z.object({
    ...overlayBase,
    kind: z.literal('image').optional(),
    key: z.string().regex(/^overlay\/[0-9a-f-]{36}\.(png|jpe?g|webp)$/),
  }),
])

export const saveOverlays = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), overlays: z.array(overlaySchema).max(50) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const before = await getProject(data.id, userId)
    if (!before) throw new Error('Project not found')
    // url is derived here rather than accepted: a stored URL is what the <img>
    // in the editor loads, and it should never be a string a caller chose.
    const overlays: Overlay[] = await Promise.all(
      data.overlays.map(async (o) =>
        o.kind === 'text' ? o : { ...o, kind: 'image' as const, url: await publicUrl(o.key) },
      ),
    )
    await updateProject(data.id, { overlays_json: JSON.stringify(overlays) })

    // Dropping an image off the timeline is the only moment its object becomes
    // unreachable, so bin it here or the bucket fills with them. Best effort:
    // the row is already correct, an orphan is not worth failing the save over.
    //
    // ponytail: read-then-delete, not a revision check, because the D1 HTTP API
    // gives us no transaction to hang one on. The editor serialises its own
    // saves, so the exposed cases are a second tab, or deleting an image while
    // an export of it is already downloading. Both fail loudly (a failed export
    // you re-run), neither loses the project.
    const kept = new Set(overlays.filter(isImageOverlay).map((o) => o.key))
    const gone = (before?.overlays ?? []).filter(isImageOverlay).filter((o) => !kept.has(o.key))
    await Promise.all(gone.map((o) => deleteObject(o.key).catch(() => {})))
    return { overlays }
  })

/** The whole Theme is stored, not an id plus overrides, so editing a preset
 *  later never silently restyles a finished project. */
export const saveTheme = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), theme: themeSchema }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    if (!project) throw new Error('Project not found')
    agentLog({
      location: 'api.saveTheme',
      message: 'persist theme',
      data: { themeId: data.theme.id, themeName: data.theme.name },
      hypothesisId: 'A',
      runId: 'post-fix-4',
    })
    await updateProject(data.id, { theme_json: JSON.stringify(data.theme as Theme) })
    return { ok: true }
  })

export const renameProjectFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    if (!project) throw new Error('Project not found')
    await updateProject(data.id, { name: data.name })
    return { name: data.name }
  })

export const retryIngest = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    void runIngest(data.id)
    return { ok: true }
  })

export const deleteProjectFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    if (!project) throw new Error('Project not found')
    await deleteProject(data.id)
    if (project) {
      const keys = [
        project.src_key,
        project.norm_key,
        exportKeyOf(project.export_url),
        keyOf(project.poster_url, 'poster'),
        ...project.overlays.filter(isImageOverlay).map((o) => o.key),
      ]
      // Best effort: the row is already gone, so a failed delete must not turn
      // into an error the user can do anything about. Worst case is an orphan.
      await Promise.all(keys.filter((k): k is string => Boolean(k)).map((k) => deleteObject(k).catch(() => {})))
    }
    return { ok: true }
  })

/**
 * A fresh presigned URL that forces a save rather than a tab navigation. Signed
 * on demand rather than stored, so it cannot go stale like export_url can.
 */
export const getDownloadUrl = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    const key = exportKeyOf(project?.export_url ?? null)
    if (!project || !key) throw new Error('This project has not been exported yet')
    const name = project.name.replace(/[^\w. -]+/g, '').trim() || 'subit'
    agentLog({
      location: 'api.getDownloadUrl',
      message: 'download requested',
      data: { themeId: project.theme?.id, exportKey: key.slice(-12) },
      hypothesisId: 'C',
      runId: 'post-fix-7',
    })
    return { url: await presignDownloadUrl(key, `${name}.mp4`) }
  })

export const startExport = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), theme: themeSchema }))
  .handler(async ({ data }) => {
    const userId = await requireUserId()
    const project = await getProject(data.id, userId)
    if (!project) throw new Error('Project not found')
    agentLog({
      location: 'api.startExport',
      message: 'start export',
      data: {
        themeId: data.theme.id,
        themeName: data.theme.name,
        boxColor: data.theme.boxColor,
      },
      hypothesisId: 'A',
      runId: 'post-fix-7',
    })
    const jobId = crypto.randomUUID()
    // Returns immediately and lets the promise run detached. Fine on a
    // long-lived Node process, broken on serverless: the platform freezes the
    // instance once the response is sent. Do not deploy this to Workers.
    void runExport(data.id, jobId, data.theme as Theme)
    return { jobId }
  })

export const getJob = createServerFn({ method: 'GET' })
  .validator(z.object({ jobId: z.string().min(1) }))
  .handler(async ({ data }) => jobs.get(data.jobId) ?? { status: 'error' as const, pct: 0, error: 'Job lost, retry' })

export const debugIngestFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      location: z.string(),
      message: z.string(),
      hypothesisId: z.string().optional(),
      runId: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    agentLogD8(data)
    return { ok: true }
  })
