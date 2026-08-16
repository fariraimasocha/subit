/** Word timings as Whisper returns them, in seconds. */
export type Word = { text: string; start: number; end: number }

export type Cue = {
  id: string
  start: number
  end: number
  words: Word[]
}

export type GroupOpts = {
  maxWords?: number
  maxChars?: number
  gapMs?: number
  maxDurMs?: number
  /** Hold a cue over a short silence so captions do not strobe. */
  holdMs?: number
  holdGapMs?: number
}

/**
 * maxChars is a proxy for line WIDTH, and 20 is too generous for the display
 * faces this app ships. Measured in Anton at the Hormozi default (7.5% of a
 * 1920 frame, so 144px): "HELLO AND WELCOME" is 17 characters and 1144px wide
 * on a 1080px frame, so it clipped at both edges in the burn. Anton averages
 * about 0.47em per character, giving roughly 14 characters inside a 90% safe
 * width. WrapStyle 2 means ASS will not wrap for us, so the grouping has to
 * keep lines short enough on its own.
 *
 * ponytail: a tuned constant, not per-font measurement at grouping time. Cues
 * stay theme-independent, which is what lets you switch preset without
 * re-transcribing. Ceiling: crank Font size past roughly 11% and long cues can
 * still touch the edges.
 */
const DEFAULTS = {
  maxWords: 3,
  maxChars: 14,
  gapMs: 350,
  maxDurMs: 1800,
  holdMs: 140,
  holdGapMs: 800,
} satisfies Required<GroupOpts>

const HARD_BREAK = /[.?!]["')\]]*\s*$/
const SOFT_BREAK = /[,;:]["')\]]*\s*$/

let seq = 0
/** Deterministic-ish local id. Cues never leave this process before being persisted. */
function cueId() {
  seq += 1
  return `c${Date.now().toString(36)}${seq.toString(36)}`
}

function build(words: Word[]): Cue {
  return { id: cueId(), start: words[0].start, end: words[words.length - 1].end, words }
}

const charLen = (words: Word[]) => words.reduce((n, w) => n + w.text.trim().length, 0) + words.length - 1

export function groupWords(words: Word[], opts: GroupOpts = {}): Cue[] {
  const o = { ...DEFAULTS, ...opts }
  const clean = words.filter((w) => w.text.trim().length > 0)
  if (clean.length === 0) return []

  const cues: Cue[] = []
  let buf: Word[] = []

  for (let i = 0; i < clean.length; i++) {
    const w = clean[i]
    const prev = buf[buf.length - 1]

    // A big gap or an over-long cue closes the buffer before this word joins it.
    if (prev) {
      const gap = (w.start - prev.end) * 1000
      const dur = (w.end - buf[0].start) * 1000
      const tooMany = buf.length >= o.maxWords
      const tooWide = charLen([...buf, w]) > o.maxChars && buf.length >= 1
      if (gap > o.gapMs || dur > o.maxDurMs || tooMany || tooWide) {
        cues.push(build(buf))
        buf = []
      }
    }

    buf.push(w)

    const t = w.text.trim()
    // Hard punctuation always ends a cue. Soft punctuation only once the cue has
    // two words, so single-word fragments do not flash by.
    if (HARD_BREAK.test(t) || (SOFT_BREAK.test(t) && buf.length >= 2)) {
      cues.push(build(buf))
      buf = []
    }
  }
  if (buf.length) cues.push(build(buf))

  return hold(cues, o.holdMs, o.holdGapMs)
}

/**
 * Extend each cue into the following silence, capped, so captions do not strobe.
 * Only short gaps are held: past `holdGapMs` the silence is a real pause and the
 * caption should clear rather than hang on for another frame or two.
 */
function hold(cues: Cue[], holdMs: number, holdGapMs: number): Cue[] {
  for (let i = 0; i < cues.length; i++) {
    const next = cues[i + 1]
    const gap = next ? (next.start - cues[i].end) * 1000 : holdMs
    if (gap <= 0 || gap >= holdGapMs) continue
    cues[i].end += Math.min(holdMs, gap) / 1000
  }
  return cues
}

/** Split a cue after `wordIndex` (0-based, inclusive). No-op at the edges. */
export function splitCue(cues: Cue[], cueId_: string, wordIndex: number): Cue[] {
  const i = cues.findIndex((c) => c.id === cueId_)
  if (i < 0) return cues
  const c = cues[i]
  if (wordIndex < 0 || wordIndex >= c.words.length - 1) return cues
  const a = build(c.words.slice(0, wordIndex + 1))
  const b = build(c.words.slice(wordIndex + 1))
  return [...cues.slice(0, i), a, b, ...cues.slice(i + 1)]
}

/** Merge the cue with the one after it. */
export function mergeCues(cues: Cue[], cueId_: string): Cue[] {
  const i = cues.findIndex((c) => c.id === cueId_)
  if (i < 0 || i === cues.length - 1) return cues
  const merged = build([...cues[i].words, ...cues[i + 1].words])
  return [...cues.slice(0, i), merged, ...cues.slice(i + 2)]
}

/**
 * Move a cue's boundaries. Word timings inside are scaled to fit, so the active
 * word highlight stays proportional. Editing a word's TEXT never comes through
 * here, which is exactly what "fix Whisper mistakes" means.
 */
export function retime(cues: Cue[], cueId_: string, start: number, end: number): Cue[] {
  const i = cues.findIndex((c) => c.id === cueId_)
  if (i < 0 || !(end > start)) return cues
  const c = cues[i]
  const span = c.end - c.start
  const k = span > 0 ? (end - start) / span : 0
  const words = c.words.map((w) => ({
    ...w,
    start: span > 0 ? start + (w.start - c.start) * k : start,
    end: span > 0 ? start + (w.end - c.start) * k : end,
  }))
  const next = { ...c, start, end, words }
  return [...cues.slice(0, i), next, ...cues.slice(i + 1)]
}

/** Replace one word's text. Timings untouched. */
export function editWord(cues: Cue[], cueId_: string, wordIndex: number, text: string): Cue[] {
  const i = cues.findIndex((c) => c.id === cueId_)
  if (i < 0) return cues
  const c = cues[i]
  if (wordIndex < 0 || wordIndex >= c.words.length) return cues
  const words = c.words.map((w, wi) => (wi === wordIndex ? { ...w, text } : w))
  return [...cues.slice(0, i), { ...c, words }, ...cues.slice(i + 1)]
}

/** Index of the cue covering `t`, or -1. Used by the transcript panel, not the overlay. */
export function cueAt(cues: Cue[], t: number): number {
  return cues.findIndex((c) => t >= c.start && t <= c.end)
}

export type CueCluster = {
  id: string
  ids: string[]
  start: number
  end: number
  text: string
}

/**
 * Join back-to-back short cues into phrase-length chips for the timeline.
 * Stored cues stay as they are. The transcript panel still edits each one.
 */
export function clusterCues(
  cues: Cue[],
  opts?: { maxChars?: number; maxDur?: number; gap?: number },
): CueCluster[] {
  const maxChars = opts?.maxChars ?? 42
  const maxDur = opts?.maxDur ?? 2.6
  const gap = opts?.gap ?? 0.08
  const out: CueCluster[] = []
  for (const c of cues) {
    const text = c.words.map((w) => w.text.trim()).join(' ')
    const last = out[out.length - 1]
    if (
      last &&
      c.start - last.end <= gap &&
      last.text.length + 1 + text.length <= maxChars &&
      c.end - last.start <= maxDur
    ) {
      last.end = c.end
      last.text = `${last.text} ${text}`
      last.ids.push(c.id)
    } else {
      out.push({ id: c.id, ids: [c.id], start: c.start, end: c.end, text })
    }
  }
  return out
}

/** Scale every cue in a cluster into a new window, keeping relative word timing. */
export function retimeCluster(cues: Cue[], ids: string[], start: number, end: number): Cue[] {
  const members = ids.map((id) => cues.find((c) => c.id === id)).filter((c): c is Cue => Boolean(c))
  if (members.length === 0 || !(end > start)) return cues
  const old0 = members[0].start
  const old1 = members[members.length - 1].end
  const oldSpan = old1 - old0
  if (oldSpan <= 0) return cues
  let next = cues
  for (const m of members) {
    const s = start + ((m.start - old0) / oldSpan) * (end - start)
    const e = start + ((m.end - old0) / oldSpan) * (end - start)
    next = retime(next, m.id, s, e)
  }
  return next
}
