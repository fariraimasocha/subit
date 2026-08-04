/**
 * Image overlays: the second thing that gets burned onto a video, alongside the
 * captions. Everything is a percentage of the FRAME, never a pixel, which is the
 * only reason the DOM preview (src/components/image-overlay.tsx) and the ffmpeg
 * burn below can agree at any resolution.
 */
export type Overlay = {
  id: string
  /** R2 object key, e.g. `overlay/<uuid>.png`. The export reads this, not `url`. */
  key: string
  /** Preview URL, derived server side in saveOverlays. Never trusted from a client. */
  url: string
  /** Shown as the block label on the timeline. */
  name: string
  start: number
  end: number
  /** Centre X, % of frame width. */
  xPct: number
  /** Centre Y, % of frame height. */
  yPct: number
  /** % of frame width. Height follows the image's own aspect ratio. */
  widthPct: number
}

export const MIN_SPAN = 0.2

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Pull an overlay back inside the frame and the clip. `duration` of 0 means the
 * video has not reported one yet, in which case only the lower bound applies.
 */
export function clampOverlay(o: Overlay, duration: number): Overlay {
  const limit = duration > 0 ? duration : Number.MAX_SAFE_INTEGER
  const start = clamp(o.start, 0, Math.max(0, limit - MIN_SPAN))
  return {
    ...o,
    start,
    end: clamp(o.end, start + MIN_SPAN, limit),
    // Same 5-95 bounds the caption drag uses: an overlay centred off frame is
    // unreachable afterwards, and a fully off-frame one looks like a lost image.
    xPct: clamp(o.xPct, 5, 95),
    yPct: clamp(o.yPct, 5, 95),
    widthPct: clamp(o.widthPct, 5, 100),
  }
}

/** Trim seconds to milliseconds. Filter strings and JSON both get shorter. */
const ms = (n: number) => Math.round(n * 1000) / 1000

export type Filter = { filter: string | null; inputs: string[] }

/**
 * Renderer B. Builds the -filter_complex for one export: every image composited
 * in array order, then the captions LAST so they always draw on top of an image
 * that happens to sit over them.
 *
 * The images arrive as extra `-i` inputs (`ov0.png`, indexes 1..n) rather than
 * as paths inside the graph, so no user-supplied string is ever parsed by
 * ffmpeg's filter lexer. `assFile` is null when the project has no cues.
 *
 * Positions use ffmpeg's own expressions, so the scaled height never has to be
 * computed here: overlay_w/overlay_h are whatever `scale` produced.
 */
export function overlayFilter(overlays: Overlay[], assFile: string | null, frameWidth: number): Filter {
  const inputs = overlays.map((o, i) => `ov${i}${extOf(o.key)}`)
  if (overlays.length === 0 && !assFile) return { filter: null, inputs: [] }

  const parts: string[] = []
  let last = '0:v'

  overlays.forEach((o, i) => {
    const n = i + 1
    // Pixels, not `iw*pct/100`: inside the image's own scale filter `iw` is the
    // IMAGE's width, so that expression would size a logo relative to itself and
    // ignore the frame entirely. Rounded to an even width because the overlay is
    // converted to a chroma-subsampled format to composite onto yuv420p.
    parts.push(`[${n}:v]scale=${even((o.widthPct / 100) * frameWidth)}:-1[s${n}]`)
    parts.push(
      `[${last}][s${n}]overlay=` +
        `x=(main_w*${ms(o.xPct)}/100)-(overlay_w/2):` +
        `y=(main_h*${ms(o.yPct)}/100)-(overlay_h/2):` +
        `enable='between(t,${ms(o.start)},${ms(o.end)})'[o${n}]`,
    )
    last = `o${n}`
  })

  if (assFile) parts.push(`[${last}]subtitles=${assFile}:fontsdir=fonts[v]`)
  // Nothing to draw on the last link but the graph still has to name its output.
  else parts.push(`[${last}]null[v]`)

  return { filter: parts.join(';'), inputs }
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** `.png` etc, lowercased, from a key the server has already validated. */
function extOf(key: string) {
  const ext = key.split('.').pop()?.toLowerCase()
  return ext ? `.${ext}` : '.png'
}
