import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toAss } from './ass.ts'
import { groupWords, type Word } from './cues.ts'
import { assBoxBorderPx, assScaleFor, baselineShiftEm, metrics, THEMES } from './theme.ts'

const hormozi = THEMES[0]
const say = (text: string): Word[] =>
  text.split(' ').map((t, i) => ({ text: t, start: i * 0.3, end: i * 0.3 + 0.25 }))

const styleLine = (ass: string) => ass.split('\n').find((l) => l.startsWith('Style: Main'))!
const dialogue = (ass: string) => ass.split('\n').filter((l) => l.startsWith('Dialogue:'))

test('PlayRes matches the frame it will be burned onto', () => {
  const ass = toAss(groupWords(say('one two')), hormozi, 1080, 1920)
  assert.match(ass, /^PlayResX: 1080$/m)
  assert.match(ass, /^PlayResY: 1920$/m)
})

test('colours are &HAABBGGRR& with reversed bytes and inverted alpha', () => {
  const theme = { ...hormozi, primary: '#123456', outline: '#000000' }
  const parts = styleLine(toAss(groupWords(say('x')), theme, 1080, 1920)).split(',')
  // Name, Fontname, Fontsize, PrimaryColour, ...
  assert.equal(parts[3], '&H00563412&')
})

/**
 * The measured anti-drift contract. A burn at 1080x1920 with the Hormozi preset
 * puts ink in a 501x155 box centred 2.4px below the anchor; the same theme in
 * the DOM overlay puts it in a 500x155 box 2.0px below. If either number below
 * changes, re-measure a burned frame before believing the new one.
 */
test('font size cancels the libass win-metrics scaling', () => {
  const ass = toAss(groupWords(say('x')), hormozi, 1080, 1920)
  const m = metrics(hormozi, 1920)
  const fontsize = Number(styleLine(ass).split(',')[2])
  assert.equal(m.fontPx, 144)
  // Anton: 2048 / (2876 + 674)
  assert.ok(Math.abs(fontsize - 144 / assScaleFor(hormozi.fontFile)) < 0.01)
  assert.ok(Math.abs(fontsize - 249.61) < 0.05, `expected ~249.61, got ${fontsize}`)
})

test('the anchor is shifted up to match where CSS puts the baseline', () => {
  const ass = toAss(groupWords(say('x')), hormozi, 1080, 1920)
  const [, y] = dialogue(ass)[0].match(/\\pos\(([\d.]+),([\d.]+)\)/)!.slice(1)
  const m = metrics(hormozi, 1920)
  assert.ok(Math.abs(m.centreY - 1497.6) < 1e-6)
  assert.ok(baselineShiftEm(hormozi.fontFile) > 0, 'Anton sits low, so the shift is up')
  assert.ok(Math.abs(Number(y) - 1481.18) < 0.05, `expected ~1481.18, got ${y}`)
})

test('outline and shadow are plain script pixels, uncorrected', () => {
  const parts = styleLine(toAss(groupWords(say('x')), hormozi, 1080, 1920)).split(',')
  const m = metrics(hormozi, 1920)
  assert.ok(Math.abs(Number(parts[16]) - m.outlinePx) < 0.01)
  assert.ok(Math.abs(Number(parts[17]) - m.shadowPx) < 0.01)
})

test('an unknown font falls back rather than throwing', () => {
  const ass = toAss(groupWords(say('x')), { ...hormozi, fontFile: 'Gone.ttf' }, 1080, 1920)
  assert.equal(Number(styleLine(ass).split(',')[2]), 144)
})

test('one Dialogue event per word, each highlighting exactly one span', () => {
  const cues = groupWords(say('one two three'))
  const lines = dialogue(toAss(cues, hormozi, 1080, 1920))
  assert.equal(lines.length, cues.reduce((n, c) => n + c.words.length, 0))
  for (const l of lines) {
    assert.equal((l.match(/\\1c&H0000D4FF&/g) ?? []).length, 1, l)
  }
})

test('highlightMode none emits one event per cue', () => {
  const cues = groupWords(say('one two three'))
  const lines = dialogue(toAss(cues, { ...hormozi, highlightMode: 'none' }, 1080, 1920))
  assert.equal(lines.length, cues.length)
})

test('uppercase and box mode reach the output', () => {
  const upper = toAss(groupWords(say('quiet')), hormozi, 1080, 1920)
  assert.match(upper, /QUIET/)
  const boxed = styleLine(toAss(groupWords(say('x')), { ...hormozi, boxColor: '#000000' }, 1080, 1920))
  assert.equal(boxed.split(',')[15], '3', 'BorderStyle 3 is the opaque box')
  assert.ok(Number(boxed.split(',')[16]) > 0, 'boxed styles need Outline padding for libass')
})

test('Kendrick preset emits a visible ASS box despite outlinePct 0', () => {
  const kendrick = THEMES.find((t) => t.id === 'kendrick')!
  const parts = styleLine(toAss(groupWords(say('x')), kendrick, 1080, 1920)).split(',')
  assert.equal(parts[15], '3')
  assert.ok(Number(parts[16]) > 0, `expected box outline px, got ${parts[16]}`)
})

/** ASS &HAABBGGRR& so a test can compare the style line to the Theme fields. */
function bgr(hex: string) {
  const h = hex.replace('#', '').slice(0, 6).padEnd(6, '0')
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase()
}

test('every preset maps preview colours onto the ASS fields libass actually paints', () => {
  assert.ok(THEMES.length >= 16, `expected a full preset list, got ${THEMES.length}`)
  const boxed = THEMES.filter((t) => t.boxColor)
  assert.deepEqual(
    boxed.map((t) => t.id),
    ['kendrick', 'marker', 'lime', 'blackout'],
  )
  for (const theme of THEMES) {
    const parts = styleLine(toAss(groupWords(say('one two')), theme, 1080, 1920)).split(',')
    assert.equal(parts[3], bgr(theme.primary), `${theme.id} primary`)
    if (theme.boxColor) {
      assert.equal(parts[15], '3', `${theme.id} BorderStyle`)
      assert.equal(parts[5], bgr(theme.boxColor), `${theme.id} box must be OutlineColour`)
      assert.ok(Number(parts[16]) > 0, `${theme.id} boxed Outline padding`)
    } else {
      assert.equal(parts[15], '1', `${theme.id} BorderStyle`)
      assert.equal(parts[5], bgr(theme.outline), `${theme.id} outline stroke`)
    }
    if (theme.highlightMode === 'color') {
      const lines = dialogue(toAss(groupWords(say('one two')), theme, 1080, 1920))
      assert.ok(
        lines.some((l) => l.includes(`\\1c${bgr(theme.highlight)}`)),
        `${theme.id} highlight override`,
      )
    }
  }
})

test('Marker yellow box is OutlineColour, not the black outline stroke', () => {
  const marker = THEMES.find((t) => t.id === 'marker')!
  const parts = styleLine(toAss(groupWords(say('building your')), marker, 1080, 1920)).split(',')
  assert.equal(parts[5], bgr('#FDE047'))
  assert.notEqual(parts[5], bgr(marker.outline))
  assert.equal(parts[3], bgr('#111111'))
})

test('boxed presets keep CSS padding, not a square Outline inset', () => {
  for (const id of ['kendrick', 'marker', 'lime', 'blackout'] as const) {
    const theme = THEMES.find((t) => t.id === id)!
    const ass = toAss(groupWords(say('building your')), theme, 1080, 1920)
    const { x, y } = assBoxBorderPx(metrics(theme, 1920).fontPx)
    assert.ok(x > y, `${id} should pad more on the sides`)
    assert.match(ass, new RegExp(`\\\\xbord${x}\\\\ybord${y}`))
    assert.equal(styleLine(ass).split(',')[17], '0', `${id} must not drop a shadow on the box`)
  }
})

test('stroked presets keep a 85 percent black shadow like the overlay', () => {
  const parts = styleLine(toAss(groupWords(say('x')), hormozi, 1080, 1920)).split(',')
  assert.match(parts[6], /^&H26/i)
})

test('braces and newlines in a word cannot inject override tags', () => {
  const words: Word[] = [{ text: '{\\fscx200}hi\nthere', start: 0, end: 1 }]
  const line = dialogue(toAss(groupWords(words), { ...hormozi, uppercase: false }, 1080, 1920))[0]
  const body = line.slice(line.indexOf('}}') >= 0 ? 0 : 0).split(',,')[1] ?? line
  assert.ok(!/\\fscx/.test(body), body)
  assert.ok(!/\n/.test(line))
})

test('timestamps are h:mm:ss.cc', () => {
  const words: Word[] = [{ text: 'x', start: 3661.5, end: 3662 }]
  assert.match(dialogue(toAss(groupWords(words), hormozi, 1080, 1920))[0], /1:01:01\.50/)
})
