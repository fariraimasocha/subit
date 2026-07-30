import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Cue } from '~/lib/cues.ts'
import type { Theme } from '~/lib/theme.ts'
import { createProject, deleteProject, getProject, listProjects } from './d1.server.ts'
import type { Project } from '~/lib/project.ts'
import { jobs, runExport, runIngest } from './jobs.server.ts'
import { buildKey, presignPutUrl, r2Configured } from './r2.server.ts'
import { d1Configured } from './d1.server.ts'
import { groqConfigured } from './groq.server.ts'
import { updateProject } from './d1.server.ts'

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

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

export const presign = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      filename: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    }),
  )
  .handler(async ({ data }) => {
    const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'mp4'
    if (!['mp4', 'mov', 'm4v', 'webm'].includes(ext)) throw new Error('Only MP4 and MOV files are supported')
    const key = buildKey('src', ext)
    const url = await presignPutUrl(key, data.contentType, data.size)
    return { key, url }
  })

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().min(1).max(200), srcKey: z.string().min(1) }))
  .handler(async ({ data }) => {
    const id = crypto.randomUUID()
    await createProject(id, data.name, data.srcKey)
    // Detached on purpose. Long-lived Node process only, see runIngest.
    void runIngest(id)
    return { id }
  })

export const listProjectsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Project[]> => listProjects())

export const getProjectFn = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<Project | null> => getProject(data.id))

export const saveCues = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), cues: z.array(cueSchema) }))
  .handler(async ({ data }) => {
    await updateProject(data.id, { cues_json: JSON.stringify(data.cues as Cue[]) })
    return { ok: true }
  })

/** The whole Theme is stored, not an id plus overrides, so editing a preset
 *  later never silently restyles a finished project. */
export const saveTheme = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1), theme: themeSchema }))
  .handler(async ({ data }) => {
    await updateProject(data.id, { theme_json: JSON.stringify(data.theme as Theme) })
    return { ok: true }
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
    await deleteProject(data.id)
    return { ok: true }
  })

export const startExport = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const jobId = crypto.randomUUID()
    // Returns immediately and lets the promise run detached. Fine on a
    // long-lived Node process, broken on serverless: the platform freezes the
    // instance once the response is sent. Do not deploy this to Workers.
    void runExport(data.id, jobId)
    return { jobId }
  })

export const getJob = createServerFn({ method: 'GET' })
  .validator(z.object({ jobId: z.string().min(1) }))
  .handler(async ({ data }) => jobs.get(data.jobId) ?? { status: 'error' as const, pct: 0, error: 'Job lost, retry' })
