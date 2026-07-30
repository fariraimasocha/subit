import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Word } from '~/lib/cues.ts'
import { extractAudio } from './ffmpeg.server.ts'

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo'
/** Groq's hard cap. 16 kHz mono FLAC is roughly 18 KB/s, so about 23 minutes. */
const MAX_BYTES = 25 * 1024 * 1024
const CHUNK_SEC = 600

export function groqConfigured() {
  return Boolean(process.env.GROQ_API_KEY)
}

type VerboseJson = {
  words?: { word?: string; text?: string; start: number; end: number }[]
  segments?: { words?: { word?: string; text?: string; start: number; end: number }[] }[]
}

async function transcribeFile(file: string, cwd: string): Promise<Word[]> {
  const abs = path.resolve(cwd, file)
  const buf = await readFile(abs)
  const fd = new FormData()
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'audio/flac' }), 'audio.flac')
  fd.append('model', MODEL)
  fd.append('response_format', 'verbose_json')
  // The [] bracket suffix is the single most common failure here. It is a
  // repeated key WITH the suffix, not a JSON array string. Get it wrong and you
  // silently receive segments with no `words` array.
  fd.append('timestamp_granularities[]', 'word')
  fd.append('timestamp_granularities[]', 'segment')
  fd.append('temperature', '0')

  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: fd,
  })
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 500)}`)
  const json = (await r.json()) as VerboseJson

  const raw = json.words ?? json.segments?.flatMap((s) => s.words ?? []) ?? []
  if (raw.length === 0) throw new Error('Groq returned no word timestamps')
  return raw.map((w) => ({ text: (w.word ?? w.text ?? '').trim(), start: w.start, end: w.end }))
}

/**
 * ponytail: sequential, not parallel. A 60 minute video costs three round trips
 * instead of one. Ceiling: Promise.all over the chunks if latency ever matters.
 */
export async function transcribe(videoFile: string, cwd: string, durationSec: number): Promise<Word[]> {
  if (!groqConfigured()) throw new Error('GROQ_API_KEY is not set')

  const whole = await extractAudio(videoFile, cwd, 'audio.flac')
  if ((await stat(path.resolve(cwd, whole))).size <= MAX_BYTES) return transcribeFile(whole, cwd)

  const words: Word[] = []
  for (let offset = 0; offset < durationSec; offset += CHUNK_SEC) {
    const name = `audio-${offset}.flac`
    await extractAudio(videoFile, cwd, name, offset, CHUNK_SEC)
    const chunk = await transcribeFile(name, cwd)
    for (const w of chunk) words.push({ ...w, start: w.start + offset, end: w.end + offset })
  }
  if (words.length === 0) throw new Error('Groq returned no word timestamps')
  return words
}
