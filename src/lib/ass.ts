import type { Cue } from './cues.ts'
import { assScaleFor, baselineShiftEm, metrics, type Theme } from './theme.ts'

/**
 * ASS colour is &HAABBGGRR& with AA=00 meaning OPAQUE.
 * Byte order reversed, alpha inverted. Both of those catch everyone once.
 */
function bgr(hex: string, alphaHex = '00') {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return `&H${alphaHex}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
}

function ts(sec: number) {
  const s = Math.max(0, sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s - h * 3600 - m * 60
  const cs = Math.floor((rest % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(rest)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/** Dialogue text is a single line: strip newlines and neutralise the escape char. */
function esc(text: string) {
  return text.replace(/\\/g, '∖').replace(/[\r\n]+/g, ' ').replace(/\{/g, '(').replace(/\}/g, ')')
}

/**
 * `width`/`height` MUST be the encoded frame size of the exact file being
 * burned, straight from the probe. libass scales PlayRes -> frame, so a
 * mismatch silently shifts every \pos and rescales every font.
 */
export function toAss(cues: Cue[], theme: Theme, width: number, height: number): string {
  const m = metrics(theme, height)
  const box = theme.boxColor !== null

  // ASS booleans are -1/0. BorderStyle 3 = opaque box, 1 = outline.
  // Alignment 5 = middle-centre, matching the CSS translate(-50%,-50%).
  // WrapStyle 2 = no auto wrap; 1 to 3 word cues never need it.
  // See FONTS.assScale: libass sizes to usWinAscent+usWinDescent, CSS sizes to
  // the em square. Dividing here makes the burned glyphs the same physical size
  // as the ones the overlay painted. Outline, Shadow and Spacing are plain
  // script pixels and need no such correction (verified by measuring a burn).
  const assFontSize = m.fontPx / assScaleFor(theme.fontFile)

  const style = [
    'Style: Main',
    theme.fontFamily,
    round(assFontSize),
    bgr(theme.primary),
    bgr(theme.primary), // SecondaryColour, unused without \k
    bgr(theme.outline),
    bgr(box ? theme.boxColor! : '#000000'),
    theme.weight >= 700 ? -1 : 0, // Bold
    0, // Italic
    0, // Underline
    0, // StrikeOut
    100, // ScaleX
    100, // ScaleY
    round(theme.letterSpacingEm * m.fontPx), // Spacing, ASS wants pixels
    0, // Angle
    box ? 3 : 1, // BorderStyle
    round(m.outlinePx),
    round(m.shadowPx),
    5, // Alignment: middle-centre
    0,
    0,
    0, // Margins, unused with \pos
    1, // Encoding
  ].join(',')

  const head = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    `PlayResX: ${Math.round(width)}`,
    `PlayResY: ${Math.round(height)}`,
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]

  // Shift the anchor up so the burned baseline lands where the browser put it.
  // See baselineShiftEm: CSS uses hhea metrics, libass uses the OS/2 win pair.
  const anchorY = m.centreY - m.fontPx * baselineShiftEm(theme.fontFile)
  const pos = `{\\pos(${round(width / 2)},${round(anchorY)})}`
  const events: string[] = []

  for (const cue of cues) {
    const texts = cue.words.map((w) => {
      const t = w.text.trim()
      return esc(theme.uppercase ? t.toUpperCase() : t)
    })
    if (texts.every((t) => t.length === 0)) continue

    if (theme.highlightMode === 'none') {
      events.push(`Dialogue: 0,${ts(cue.start)},${ts(cue.end)},Main,,0,0,0,,${pos}${texts.join(' ')}`)
      continue
    }

    // ponytail: one Dialogue event per word rather than \k karaoke tags. Three
    // times the lines, zero karaoke-renderer semantics to reason about, and it
    // is the exact same "recolour the active span" operation the DOM overlay
    // performs, which is what keeps the two honest.
    for (let i = 0; i < cue.words.length; i++) {
      const from = i === 0 ? cue.start : cue.words[i].start
      const to = i === cue.words.length - 1 ? cue.end : cue.words[i + 1].start
      if (!(to > from)) continue
      const line = texts
        .map((t, j) => (j === i ? `{\\1c${bgr(theme.highlight)}}${t}{\\1c${bgr(theme.primary)}}` : t))
        .join(' ')
      events.push(`Dialogue: 0,${ts(from)},${ts(to)},Main,,0,0,0,,${pos}${line}`)
    }
  }

  return [...head, ...events, ''].join('\n')
}

const round = (n: number) => Math.round(n * 100) / 100
