import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assScaleFor, baselineShiftEm, FONTS, metrics, THEMES } from './theme.ts'

/**
 * A preset naming a font that is not in FONTS silently falls back to assScale 1,
 * which burns at ~60% of the previewed size. Nothing else catches that.
 */
test('every preset uses a registered font, consistently named', () => {
  for (const t of THEMES) {
    const f = FONTS.find((x) => x.file === t.fontFile)
    assert.ok(f, `${t.id} references an unregistered font file: ${t.fontFile}`)
    assert.equal(t.fontFamily, f.family, `${t.id} family must match the TTF name table`)
    assert.notEqual(assScaleFor(t.fontFile), 1, `${t.id} fell back to the uncorrected scale`)
  }
})

test('preset ids are unique', () => {
  const ids = THEMES.map((t) => t.id)
  assert.equal(new Set(ids).size, ids.length)
})

/**
 * Measured ceilings for a 14 character cue at 90% of a 1080px frame. Exceeding
 * one clips the burn at both edges, since WrapStyle 2 never wraps.
 */
const MAX_PCT: Record<string, number> = {
  'Anton-Regular.ttf': 7.8,
  'ArchivoBlack-Regular.ttf': 4.9,
  'Bangers-Regular.ttf': 9.0,
  'BebasNeue-Regular.ttf': 9.5,
  'Inter-Bold.ttf': 5.4,
  'LuckiestGuy-Regular.ttf': 6.4,
  'Montserrat-ExtraBold.ttf': 5.1,
  'Oswald-Bold.ttf': 7.0,
  'Poppins-ExtraBold.ttf': 5.6,
}

test('no preset is sized past its measured width ceiling', () => {
  for (const t of THEMES) {
    const max = MAX_PCT[t.fontFile]
    assert.ok(max, `no measured ceiling for ${t.fontFile}`)
    assert.ok(t.fontSizePct <= max, `${t.id} is ${t.fontSizePct}%, ceiling is ${max}%`)
  }
})

test('metrics stay proportional to frame height', () => {
  const t = THEMES[0]
  const a = metrics(t, 1080)
  const b = metrics(t, 1920)
  assert.ok(Math.abs(b.fontPx / a.fontPx - 1920 / 1080) < 1e-9)
})

test('every font has a usable baseline shift', () => {
  for (const f of FONTS) assert.ok(Number.isFinite(baselineShiftEm(f.file)))
})
