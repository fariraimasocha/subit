import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { toAss } from '~/lib/ass.ts'
import { groupWords } from '~/lib/cues.ts'
import { overlayFilter } from '~/lib/overlays.ts'
import type { IngestStage } from '~/lib/project.ts'
import { DEFAULT_THEME, type Theme } from '~/lib/theme.ts'
import { getProject, updateProject } from './d1.server.ts'
import { burn, cleanJobDir, hasAudio, makeJobDir, normalize, poster, probe } from './ffmpeg.server.ts'
import { transcribe } from './groq.server.ts'
import { buildKey, deleteObject, exportKeyOf, presignGetUrl, publicUrl, putObject } from './r2.server.ts'

/**
 * ponytail: in-memory Map. Ceiling: single process, single machine. Restart the
 * server mid-export and the job vanishes (the UI shows "lost, retry"). Fixing it
 * means a jobs table plus a reaper, which is a queue, which is what we said no to.
 */
export type Job = { status: 'running' | 'done' | 'error'; pct: number; url?: string; error?: string }
export const jobs = new Map<string, Job>()

const FONTS_DIR = path.resolve(process.cwd(), 'public/fonts')

/**
 * Normalize, probe, transcribe, group. Runs detached from the request that
 * started it. Safe here only because this is a long-lived Node process; on
 * serverless the function would be frozen the moment the response was sent,
 * which is the concrete reason Workers and Vercel are off the table.
 */
export async function runIngest(projectId: string) {
  const dir = await makeJobDir()
  try {
    const project = await getProject(projectId)
    if (!project) throw new Error('project not found')
    const stage = (s: IngestStage) => updateProject(projectId, { status: 'processing', error: null, stage: s })
    await stage('normalising')

    // ffmpeg reads the R2 object over HTTPS directly, so there is no download
    // step and no source temp file.
    const srcUrl = await presignGetUrl(project.src_key)
    const norm = await normalize(srcUrl, dir)

    // Always probe norm.mp4, never the original: iPhone portrait video is stored
    // landscape with a 90 degree display matrix, so the original reports
    // transposed dimensions and every caption would land off frame.
    const meta = await probe(norm, dir)

    await stage('uploading')
    const normKey = buildKey('norm', 'mp4')
    await putObject(normKey, await readFile(path.join(dir, norm)), 'video/mp4')
    const normUrl = await publicUrl(normKey)

    // The card thumbnail. Best effort: a project without a poster still works,
    // and failing the whole ingest over a JPEG would be absurd.
    let posterUrl: string | null = null
    try {
      const shot = await poster(norm, dir, meta.duration)
      const posterKey = buildKey('poster', 'jpg')
      await putObject(posterKey, await readFile(path.join(dir, shot)), 'image/jpeg')
      posterUrl = await publicUrl(posterKey)
    } catch (e) {
      console.warn('[ingest] no poster frame:', (e as Error).message)
    }

    await updateProject(projectId, {
      norm_key: normKey,
      norm_url: normUrl,
      poster_url: posterUrl,
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
    })

    await stage('transcribing')
    const words = (await hasAudio(norm, dir)) ? await transcribe(norm, dir, meta.duration) : []

    await stage('grouping')
    const cues = groupWords(words)

    await updateProject(projectId, {
      status: 'ready',
      stage: null,
      cues_json: JSON.stringify(cues),
      theme_json: project.theme ? JSON.stringify(project.theme) : JSON.stringify(DEFAULT_THEME),
    })
  } catch (e) {
    await updateProject(projectId, {
      status: 'error',
      // Keep the stage: it says which step failed, which is most of the triage.
      error: (e as Error).message.slice(0, 900),
    }).catch(() => {})
  } finally {
    await cleanJobDir(dir)
  }
}

/** Presigned GET to a file in the job dir. Used for norm.mp4 and every overlay. */
async function download(url: string, to: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`could not fetch ${path.basename(to)}: ${res.status}`)
  await writeFile(to, new Uint8Array(await res.arrayBuffer()))
}

export async function runExport(projectId: string, jobId: string) {
  const dir = await makeJobDir()
  jobs.set(jobId, { status: 'running', pct: 0 })
  try {
    const project = await getProject(projectId)
    if (!project) throw new Error('project not found')
    if (!project.norm_key || !project.width || !project.height) throw new Error('project has not finished processing')

    const theme: Theme = project.theme ?? DEFAULT_THEME
    await updateProject(projectId, { status: 'exporting', error: null })

    const normUrl = await presignGetUrl(project.norm_key)
    // Pull norm.mp4 down once: the burn reads it twice (video and audio copy)
    // and ffmpeg would otherwise range-request R2 the whole way through.
    await download(normUrl, path.join(dir, 'norm.mp4'))

    const hasCues = project.cues.length > 0
    if (hasCues) {
      // PlayResX/PlayResY come from the same probe that produced the file being
      // burned. Never let a caller pass them in separately.
      await writeFile(path.join(dir, 'cues.ass'), toAss(project.cues, theme, project.width, project.height), 'utf8')

      // fontsdir matches the font's INTERNAL family name, not the filename. Copy
      // the TTF into jobDir/fonts so the spawn cwd relative path works.
      await mkdir(path.join(dir, 'fonts'), { recursive: true })
      await copyFile(path.join(FONTS_DIR, theme.fontFile), path.join(dir, 'fonts', theme.fontFile))
    }

    // The graph names its inputs ov0, ov1, ... and ffmpeg opens them by index,
    // so the download order below has to stay the array order.
    const { filter, inputs } = overlayFilter(project.overlays, hasCues ? 'cues.ass' : null, project.width)
    for (const [i, name] of inputs.entries()) {
      await download(await presignGetUrl(project.overlays[i].key), path.join(dir, name))
    }

    const out = await burn({
      input: 'norm.mp4',
      extraInputs: inputs,
      filter,
      cwd: dir,
      durationSec: project.duration ?? 0,
      onPct: (pct) => {
        const j = jobs.get(jobId)
        if (j) jobs.set(jobId, { ...j, pct })
      },
    })

    const key = buildKey('export', 'mp4')
    await putObject(key, await readFile(path.join(dir, out)), 'video/mp4')
    const url = await publicUrl(key)

    await updateProject(projectId, { status: 'done', export_url: url })
    jobs.set(jobId, { status: 'done', pct: 100, url })

    // Tweaking a style and exporting again is the normal loop here, so without
    // this every re-export leaves its predecessor in the bucket forever. Done
    // only after the new row is written, so a failure never loses both.
    const stale = exportKeyOf(project.export_url)
    if (stale && stale !== key) await deleteObject(stale).catch(() => {})
  } catch (e) {
    const message = (e as Error).message.slice(0, 900)
    jobs.set(jobId, { status: 'error', pct: 0, error: message })
    await updateProject(projectId, { status: 'error', error: message }).catch(() => {})
  } finally {
    // After the upload resolves, never before.
    await cleanJobDir(dir)
  }
}
