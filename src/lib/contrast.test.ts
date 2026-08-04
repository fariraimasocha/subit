import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

/**
 * The contrast checker for the design tokens. It reads globals.css rather than
 * a copy of the values, so dimming a token in the stylesheet fails here instead
 * of shipping. Every pair below is a real adjacency in the UI: text on a
 * surface, or a border or the brand ring against the surface behind it.
 *
 * ponytail: a regex over the two token blocks, not a CSS parser. It only has to
 * understand `--name: hsl(h s% l%)` and `--name: var(--other)`, which is all
 * the token layer is allowed to contain. A token written any other way fails
 * loudly in `resolve` rather than being silently skipped.
 */
const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

function block(selector: string) {
  const start = CSS.indexOf(`${selector} {`)
  assert.notEqual(start, -1, `${selector} block missing from globals.css`)
  const body = CSS.slice(start, CSS.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const [, name, value] of body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
    out[name] = value.trim()
  }
  return out
}

const light = block(':root')
// Dark only overrides the foundation, so it falls back to :root for the rest.
const dark = { ...light, ...block('.dark') }

/** hsl(h s% l%) to linear-light sRGB. Alpha is rejected: it cannot be checked. */
function rgb(css: string): [number, number, number] {
  const m = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(css)
  assert.ok(m, `token is not a solid hsl() colour: ${css}`)
  const [h, s, l] = [Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100]
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m0 = l - c / 2
  const seg = Math.floor(h / 60) % 6
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]
  return table[seg].map((v) => v + m0) as [number, number, number]
}

function resolve(tokens: Record<string, string>, name: string): string {
  let value = tokens[name]
  assert.ok(value, `token ${name} is not defined`)
  // One hop is all the token layer uses, but loop anyway so a longer alias
  // chain reports a cycle instead of returning "var(--x)" to the hsl parser.
  for (let i = 0; i < 8 && value.startsWith('var('); i++) {
    const ref = /^var\((--[\w-]+)\)$/.exec(value)
    assert.ok(ref, `token ${name} mixes var() with something else: ${value}`)
    value = tokens[ref[1]]
    assert.ok(value, `token ${name} points at undefined ${ref[1]}`)
  }
  return value
}

function luminance(css: string) {
  const lin = rgb(css).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

function contrast(tokens: Record<string, string>, a: string, b: string) {
  const [x, y] = [luminance(resolve(tokens, a)), luminance(resolve(tokens, b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Every surface a foreground can land on. */
const SURFACES = ['bg', 'surface-1', 'surface-2', 'surface-3'] as const

for (const [themeName, tokens] of [
  ['light', light],
  ['dark', dark],
] as const) {
  test(`${themeName}: body text clears 4.5:1 on every surface`, () => {
    // Status colours are in here on purpose: a pill renders them as label text,
    // so "readable at a glance" is a contrast requirement, not a preference.
    for (const fg of ['text-primary', 'text-secondary', 'text-muted', 'ok', 'warn', 'danger']) {
      for (const bg of SURFACES) {
        const ratio = contrast(tokens, `--${fg}`, `--${bg}`)
        assert.ok(ratio >= 4.5, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs 4.5:1`)
      }
    }
  })

  test(`${themeName}: borders and the focus ring clear 3:1 on every surface`, () => {
    for (const fg of ['border-1', 'brand']) {
      for (const bg of SURFACES) {
        const ratio = contrast(tokens, `--${fg}`, `--${bg}`)
        assert.ok(ratio >= 3, `${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs 3:1`)
      }
    }
  })

  test(`${themeName}: text on a filled brand or danger button clears 4.5:1`, () => {
    for (const fill of ['brand', 'danger']) {
      const ratio = contrast(tokens, `--${fill}-foreground`, `--${fill}`)
      assert.ok(ratio >= 4.5, `${fill}-foreground on ${fill} is ${ratio.toFixed(2)}:1, needs 4.5:1`)
    }
  })

  test(`${themeName}: surfaces stay distinguishable from the page`, () => {
    // Not a WCAG rule, a regression guard: the ramp is deliberately tight so a
    // single border token can clear 3:1 against all of it. Flattening it
    // entirely would make the borders the only structure left.
    const ratio = contrast(tokens, '--surface-3', '--bg')
    assert.ok(ratio > 1.05 && ratio < 2, `surface-3 to bg is ${ratio.toFixed(2)}:1, expected a soft step`)
  })
}

test('the 14px text floor is in the theme', () => {
  assert.match(CSS, /--text-xs:\s*0\.875rem/, 'text-xs must be redefined to 14px')
})
