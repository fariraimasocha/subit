/**
 * One Theme, two renderers. The anti-drift mechanism is that a Theme contains
 * no pixels: every dimension is a percentage of video HEIGHT. The CSS overlay
 * passes the on-screen box height, the ASS generator passes the real encoded
 * height, and both go through `metrics()`. A value that cannot be expressed as
 * a percentage of height does not belong in here.
 */
export type Theme = {
  id: string
  name: string
  /** MUST match the TTF internal name table (nameID 1), not the filename. */
  fontFamily: string
  /** Basename in public/fonts. Feeds @font-face AND the ffmpeg fontsdir copy. */
  fontFile: string
  weight: number
  uppercase: boolean
  fontSizePct: number // % of video HEIGHT
  positionPct: number // % from top to the CENTRE of the caption block
  outlinePct: number
  shadowPct: number
  letterSpacingEm: number
  primary: string
  highlight: string
  outline: string
  boxColor: string | null
  highlightMode: 'color' | 'none'
}

/** The only place a percentage becomes a number. Both renderers go through here. */
export function metrics(t: Theme, videoHeight: number) {
  return {
    fontPx: (t.fontSizePct / 100) * videoHeight,
    outlinePx: (t.outlinePct / 100) * videoHeight,
    shadowPx: (t.shadowPct / 100) * videoHeight,
    centreY: (t.positionPct / 100) * videoHeight,
  }
}

// ponytail: every preset is weight 400 and the family name carries the weight
// ("Montserrat ExtraBold" is its own family). Asking for 700 would make libass
// synthesise a bolder face while the browser just used the file, which is drift.
// Ceiling: a real multi-weight family needs static TTFs per weight in
// public/fonts and a matching @font-face block in globals.css.
export const THEMES: Theme[] = [
  {
    id: 'hormozi',
    name: 'Hormozi',
    fontFamily: 'Anton',
    fontFile: 'Anton-Regular.ttf',
    weight: 400,
    uppercase: true,
    fontSizePct: 7.5,
    positionPct: 78,
    outlinePct: 0.55,
    shadowPct: 0.35,
    letterSpacingEm: 0.01,
    primary: '#FFFFFF',
    highlight: '#FFD400',
    outline: '#000000',
    boxColor: null,
    highlightMode: 'color',
  },
  {
    id: 'kendrick',
    name: 'Kendrick',
    fontFamily: 'Montserrat ExtraBold',
    fontFile: 'Montserrat-ExtraBold.ttf',
    weight: 400,
    uppercase: true,
    fontSizePct: 6.2,
    positionPct: 80,
    outlinePct: 0,
    shadowPct: 0,
    letterSpacingEm: 0,
    primary: '#FFFFFF',
    highlight: '#22D3EE',
    outline: '#000000',
    boxColor: '#000000',
    highlightMode: 'color',
  },
  {
    id: 'beast',
    name: 'Beast',
    fontFamily: 'Anton',
    fontFile: 'Anton-Regular.ttf',
    weight: 400,
    uppercase: true,
    fontSizePct: 8.2,
    positionPct: 75,
    outlinePct: 0.7,
    shadowPct: 0.4,
    letterSpacingEm: 0.02,
    primary: '#FFFFFF',
    highlight: '#22C55E',
    outline: '#000000',
    boxColor: null,
    highlightMode: 'color',
  },
  {
    id: 'clean',
    name: 'Clean',
    fontFamily: 'Inter',
    fontFile: 'Inter-Bold.ttf',
    weight: 400,
    uppercase: false,
    fontSizePct: 5.4,
    positionPct: 84,
    outlinePct: 0.3,
    shadowPct: 0.2,
    letterSpacingEm: 0,
    primary: '#FFFFFF',
    highlight: '#FACC15',
    outline: '#000000',
    boxColor: null,
    highlightMode: 'color',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    fontFamily: 'Inter',
    fontFile: 'Inter-Bold.ttf',
    weight: 400,
    uppercase: false,
    fontSizePct: 4.6,
    positionPct: 88,
    outlinePct: 0,
    shadowPct: 0.25,
    letterSpacingEm: 0,
    primary: '#FFFFFF',
    highlight: '#FFFFFF',
    outline: '#000000',
    boxColor: null,
    highlightMode: 'none',
  },
]

export const DEFAULT_THEME = THEMES[0]

/**
 * The fonts the picker offers. Same list feeds @font-face in globals.css.
 *
 * The vertical metrics are copied straight out of each TTF, because libass and
 * a browser disagree about a font in two ways and both show up as preview
 * versus export drift:
 *
 *   1. Size. CSS `font-size` is the em square. libass sizes a face so that
 *      `usWinAscent + usWinDescent` equals the ASS Fontsize, so the same number
 *      renders visibly smaller, by a different amount per font.
 *   2. Baseline. Both centre a line box on the anchor point, but CSS puts the
 *      baseline using hhea ascent and descent while libass uses the OS/2 win
 *      values. Anton's differ by 467 units, which is 16px on a 1080p frame.
 *
 * Both corrections are applied in toAss(), so the CSS overlay stays plain.
 *
 * ponytail: three sets of constants read out of the TTFs once, not a runtime
 * font parser. Adding a font means reading head.unitsPerEm, OS/2 usWinAscent
 * and usWinDescent, and hhea ascender and descender, then pasting them here.
 * Ceiling: if the list grows past a handful, parse OS/2 at ingest instead.
 */
export const FONTS = [
  { family: 'Anton', file: 'Anton-Regular.ttf', upem: 2048, winAsc: 2876, winDesc: 674, hheaAsc: 2409, hheaDesc: -674 },
  { family: 'Montserrat ExtraBold', file: 'Montserrat-ExtraBold.ttf', upem: 1000, winAsc: 1109, winDesc: 453, hheaAsc: 968, hheaDesc: -251 },
  { family: 'Inter', file: 'Inter-Bold.ttf', upem: 2048, winAsc: 2269, winDesc: 660, hheaAsc: 1984, hheaDesc: -494 },
]

/**
 * Multiply an ASS Fontsize by this to get the em size a browser would use, so
 * `toAss` divides by it. Falls back to 1, which renders small rather than
 * throwing, if a stored theme snapshot names a font no longer in the list.
 */
export function assScaleFor(fontFile: string) {
  const f = FONTS.find((x) => x.file === fontFile)
  return f ? f.upem / (f.winAsc + f.winDesc) : 1
}

/**
 * Fraction of the em size that the ASS anchor has to move UP so the burned
 * baseline lands where the browser put it. The CSS `line-height` cancels out of
 * this, which is why the overlay can pick whatever leading looks right.
 */
export function baselineShiftEm(fontFile: string) {
  const f = FONTS.find((x) => x.file === fontFile)
  if (!f) return 0
  // winDesc is stored positive and hheaDesc negative, exactly as the tables
  // hold them, so both descents subtract here.
  return (f.winAsc - f.winDesc - f.hheaAsc - f.hheaDesc) / (2 * f.upem)
}
