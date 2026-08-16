/**
 * Placed overlays: images and text burned onto a video alongside captions.
 * Everything is a percentage of the FRAME, never a pixel, which is the only
 * reason the DOM preview and the ffmpeg burn can agree at any resolution.
 *
 * `kind` is optional on images so rows saved before text overlays still load.
 */
type OverlayBase = {
  id: string
  /** Shown as the block label on the timeline. */
  name: string
  start: number
  end: number
  /** Centre X, % of frame width. */
  xPct: number
  /** Centre Y, % of frame height. */
  yPct: number
  /** % of frame width. */
  widthPct: number
}

export type ImageOverlayData = OverlayBase & {
  kind?: 'image'
  /** R2 object key, e.g. `overlay/<uuid>.png`. The export reads this, not `url`. */
  key: string
  /** Preview URL, derived server side in saveOverlays. Never trusted from a client. */
  url: string
}

export type TextOverlayData = OverlayBase & {
  kind: 'text'
  text: string
  fontFamily: string
  fontFile: string
  color: string
  /** % of frame HEIGHT, same unit caption fontSizePct uses. */
  fontSizePct: number
}

export type Overlay = ImageOverlayData | TextOverlayData

export function isTextOverlay(o: Overlay): o is TextOverlayData {
  return o.kind === 'text'
}

export function isImageOverlay(o: Overlay): o is ImageOverlayData {
  return o.kind !== 'text'
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
export function overlayFilter(
  overlays: Overlay[],
  assFile: string | null,
  frameWidth: number,
  frameHeight = 0,
): Filter {
  const images = overlays.filter(isImageOverlay)
  const inputs = images.map((o, i) => `ov${i}${extOf(o.key)}`)
  if (overlays.length === 0 && !assFile) return { filter: null, inputs: [] }

  const parts: string[] = []
  let last = '0:v'
  let imageN = 0

  overlays.forEach((o, i) => {
    const n = i + 1
    if (isTextOverlay(o)) {
      const fontPx = Math.max(8, Math.round((o.fontSizePct / 100) * (frameHeight || frameWidth)))
      const color = o.color.replace('#', '0x')
      parts.push(
        `[${last}]drawtext=` +
          `fontfile=fonts/${safeFontFile(o.fontFile)}:` +
          `text='${escapeDrawtext(o.text)}':` +
          `fontsize=${fontPx}:` +
          `fontcolor=${color}:` +
          `borderw=${Math.max(0, Math.round(fontPx * 0.08))}:` +
          `bordercolor=black:` +
          `expansion=none:` +
          `x=(w*${ms(o.xPct)}/100)-(text_w/2):` +
          `y=(h*${ms(o.yPct)}/100)-(text_h/2):` +
          `enable='between(t,${ms(o.start)},${ms(o.end)})'[o${n}]`,
      )
    } else {
      imageN += 1
      // Pixels, not `iw*pct/100`: inside the image's own scale filter `iw` is the
      // IMAGE's width, so that expression would size a logo relative to itself and
      // ignore the frame entirely. Rounded to an even width because the overlay is
      // converted to a chroma-subsampled format to composite onto yuv420p.
      parts.push(`[${imageN}:v]scale=${even((o.widthPct / 100) * frameWidth)}:-1[s${n}]`)
      parts.push(
        `[${last}][s${n}]overlay=` +
          `x=(main_w*${ms(o.xPct)}/100)-(overlay_w/2):` +
          `y=(main_h*${ms(o.yPct)}/100)-(overlay_h/2):` +
          `enable='between(t,${ms(o.start)},${ms(o.end)})'[o${n}]`,
      )
    }
    last = `o${n}`
  })

  if (assFile) {
    // alpha=1 composites the libass bitmap with a real alpha channel. Without
    // it, caption edges are punched onto yuv420p and look harsher than the CSS
    // overlay. original_size pins PlayRes to the encoded frame so libass cannot
    // pick a different authoring size and rescale the glyphs.
    const size =
      frameHeight > 0
        ? `:original_size=${Math.round(frameWidth)}x${Math.round(frameHeight)}`
        : ''
    parts.push(`[${last}]subtitles=${assFile}:fontsdir=fonts${size}:alpha=1[v]`)
  }
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

const FONT_FILES = new Set([
  'Anton-Regular.ttf',
  'ArchivoBlack-Regular.ttf',
  'Bangers-Regular.ttf',
  'BebasNeue-Regular.ttf',
  'Inter-Bold.ttf',
  'LuckiestGuy-Regular.ttf',
  'Montserrat-ExtraBold.ttf',
  'Oswald-Bold.ttf',
  'Poppins-ExtraBold.ttf',
])

function safeFontFile(file: string) {
  return FONT_FILES.has(file) ? file : 'Inter-Bold.ttf'
}

/** Keep user text out of ffmpeg's option lexer. */
export function escapeDrawtext(s: string) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/[\r\n]+/g, ' ')
}
