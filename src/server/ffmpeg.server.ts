import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * Homebrew split ffmpeg into a slim `ffmpeg` (no libass, so no `subtitles`
 * filter) and `ffmpeg-full`, which is keg-only and therefore not on PATH.
 * Prefer an explicit env var, then the keg, then whatever PATH has.
 */
function resolveBin(name: 'ffmpeg' | 'ffprobe') {
  const fromEnv = process.env[name === 'ffmpeg' ? 'FFMPEG_BIN' : 'FFPROBE_BIN']
  if (fromEnv) return fromEnv
  const keg = `/opt/homebrew/opt/ffmpeg-full/bin/${name}`
  if (existsSync(keg)) return keg
  return name
}

export const FFMPEG = resolveBin('ffmpeg')
export const FFPROBE = resolveBin('ffprobe')

export type RunOpts = {
  cwd?: string
  /** Called with each `-progress pipe:1` key=value block, already parsed. */
  onProgress?: (fields: Record<string, string>) => void
}

function run(bin: string, args: string[], opts: RunOpts = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    let buf = ''

    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString()
      out += s
      if (!opts.onProgress) return
      buf += s
      // -progress emits key=value lines, one block terminated by `progress=`.
      let i: number
      const fields: Record<string, string> = {}
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        const eq = line.indexOf('=')
        if (eq > 0) fields[line.slice(0, eq)] = line.slice(eq + 1)
      }
      if (Object.keys(fields).length) opts.onProgress(fields)
    })
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString()
      if (err.length > 40_000) err = err.slice(-20_000)
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${path.basename(bin)} exited ${code}\n${err.slice(-2000)}`)),
    )
  })
}

export async function makeJobDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'subit-'))
}

/**
 * ponytail: no reaper. macOS clears /tmp on reboot; a VPS eventually needs a
 * tmpreaper cron. Call this in a `finally` AFTER the R2 upload resolves, never
 * before, or you delete the file you are still uploading.
 */
export async function cleanJobDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
}

export type Probe = { width: number; height: number; duration: number }

export async function probe(file: string, cwd: string): Promise<Probe> {
  const out = await run(
    FFPROBE,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'json', file],
    { cwd },
  )
  const j = JSON.parse(out) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } }
  const s = j.streams?.[0]
  if (!s?.width || !s?.height) throw new Error('ffprobe found no video stream')
  return { width: s.width, height: s.height, duration: Number(j.format?.duration ?? 0) }
}

/**
 * One pass solves four problems at once: containers and codecs Chrome will not
 * play (MOV, HEVC, ProRes), iPhone rotation metadata (baked into pixels here,
 * so pixels and ASS coordinates finally agree), ambiguous ffprobe dimensions,
 * and oversized source resolution.
 *
 * ponytail: always normalize, even a clean 1080p h264 mp4. Detecting the skip
 * case costs more code than the wasted transcode costs seconds.
 */
export async function normalize(srcUrl: string, cwd: string, out = 'norm.mp4') {
  await run(
    FFMPEG,
    [
      '-y',
      '-i', srcUrl,
      '-vf', "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v', 'h264_videotoolbox', '-b:v', '8M', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      out,
    ],
    { cwd },
  )
  return out
}

/** 16 kHz mono FLAC is roughly 18 KB/s, so Groq's 25 MB cap is about 23 minutes. */
export async function extractAudio(input: string, cwd: string, out = 'audio.flac', startSec?: number, durSec?: number) {
  const args = ['-y']
  if (startSec !== undefined) args.push('-ss', String(startSec))
  args.push('-i', input)
  if (durSec !== undefined) args.push('-t', String(durSec))
  args.push('-vn', '-map', '0:a:0', '-ar', '16000', '-ac', '1', '-c:a', 'flac', '-compression_level', '8', out)
  await run(FFMPEG, args, { cwd })
  return out
}

export async function hasAudio(file: string, cwd: string) {
  const out = await run(FFPROBE, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'json', file], { cwd })
  return ((JSON.parse(out) as { streams?: unknown[] }).streams ?? []).length > 0
}

/**
 * VideoToolbox for normalize, libx264 for export. VideoToolbox has no CRF and
 * at matched bitrate visibly loses detail on high-contrast caption edges, which
 * is the one thing this product exists to render.
 *
 * `-c:a copy` is only valid because normalize already produced AAC.
 * The `subtitles=` filter value is parsed twice, so a path containing : \ or '
 * needs double escaping. Sidestepped by spawning at cwd: jobDir with a bare
 * relative filename.
 */
export async function burn(
  input: string,
  assFile: string,
  cwd: string,
  durationSec: number,
  onPct: (pct: number) => void,
  out = 'out.mp4',
) {
  await run(
    FFMPEG,
    [
      '-y',
      '-i', input,
      '-vf', `subtitles=${assFile}:fontsdir=fonts`,
      '-c:v', process.env.EXPORT_ENCODER || 'libx264',
      '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      out,
      '-progress', 'pipe:1', '-nostats', '-loglevel', 'warning',
    ],
    {
      cwd,
      onProgress: (f) => {
        if (f.progress === 'end') return onPct(100)
        const us = Number(f.out_time_us ?? f.out_time_ms)
        if (!Number.isFinite(us) || durationSec <= 0) return
        onPct(Math.min(99, Math.round((us / 1_000_000 / durationSec) * 100)))
      },
    },
  )
  return out
}
