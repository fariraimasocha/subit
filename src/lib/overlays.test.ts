import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampOverlay, escapeDrawtext, overlayFilter, type Overlay, type TextOverlayData } from './overlays.ts'

const ov = (patch: Partial<Overlay> = {}): Overlay => ({
  id: 'o1',
  key: 'overlay/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png',
  url: 'https://example.test/x.png',
  name: 'logo.png',
  start: 1,
  end: 4,
  xPct: 50,
  yPct: 50,
  widthPct: 40,
  ...patch,
})

test('no cues and no images means no filter at all', () => {
  assert.deepEqual(overlayFilter([], null, 1080), { filter: null, inputs: [] })
})

test('captions alone keep the subtitles filter on the source video', () => {
  const { filter, inputs } = overlayFilter([], 'cues.ass', 1080, 1920)
  assert.deepEqual(inputs, [])
  assert.equal(filter, '[0:v]subtitles=cues.ass:fontsdir=fonts:original_size=1080x1920:alpha=1[v]')
})

test('images are numbered inputs and the extension follows the key', () => {
  const { inputs } = overlayFilter([ov(), ov({ id: 'o2', key: 'overlay/x.webp' })], null, 1080)
  assert.deepEqual(inputs, ['ov0.png', 'ov1.webp'])
})

test('images composite in order and the captions land last', () => {
  const { filter } = overlayFilter(
    [ov(), ov({ id: 'o2', start: 5, end: 6.5, xPct: 25, yPct: 80, widthPct: 12.5 })],
    'cues.ass',
    1080,
    1920,
  )
  assert.equal(
    filter,
    '[1:v]scale=432:-1[s1];' +
      '[0:v][s1]overlay=x=(main_w*50/100)-(overlay_w/2):y=(main_h*50/100)-(overlay_h/2):' +
      "enable='between(t,1,4)'[o1];" +
      '[2:v]scale=136:-1[s2];' +
      '[o1][s2]overlay=x=(main_w*25/100)-(overlay_w/2):y=(main_h*80/100)-(overlay_h/2):' +
      "enable='between(t,5,6.5)'[o2];" +
      '[o2]subtitles=cues.ass:fontsdir=fonts:original_size=1080x1920:alpha=1[v]',
  )
})

/**
 * The overlay is sized against the FRAME, not against itself. Getting this wrong
 * (scale=iw*pct/100) silently sizes every logo relative to its own resolution,
 * so the same image lands at a different size on a 1080 and a 1920 frame.
 */
test('width is a percentage of the frame, rounded even for chroma subsampling', () => {
  const w = (pct: number, frame: number) =>
    overlayFilter([ov({ widthPct: pct })], null, frame).filter!.match(/scale=(\d+):/)![1]
  assert.equal(w(50, 1920), '960')
  assert.equal(w(50, 1080), '540')
  assert.equal(w(5, 1080), '54')
  // 33% of 1001 is 330.33, which must not reach ffmpeg as an odd width.
  assert.equal(Number(w(33, 1001)) % 2, 0)
})

test('an image-only export still names its output link', () => {
  const { filter } = overlayFilter([ov()], null, 1080)
  assert.ok(filter!.endsWith('[o1]null[v]'), filter!)
})

test('clamping keeps an overlay on frame, inside the clip and non-zero', () => {
  const c = clampOverlay(ov({ start: -3, end: 99, xPct: 120, yPct: -5, widthPct: 400 }), 10)
  assert.deepEqual(
    [c.start, c.end, c.xPct, c.yPct, c.widthPct],
    [0, 10, 95, 5, 100],
  )
  // A block dragged past the end keeps its minimum span rather than inverting.
  const late = clampOverlay(ov({ start: 20, end: 21 }), 10)
  assert.deepEqual([late.start, late.end], [9.8, 10])
})

test('an unknown duration only clamps the lower bound', () => {
  const c = clampOverlay(ov({ start: -1, end: 500 }), 0)
  assert.deepEqual([c.start, c.end], [0, 500])
})

const tx = (patch: Partial<TextOverlayData> = {}): TextOverlayData => ({
  id: 't1',
  kind: 'text',
  name: 'Text',
  text: 'Hello',
  fontFamily: 'Anton',
  fontFile: 'Anton-Regular.ttf',
  color: '#FFFFFF',
  fontSizePct: 6,
  start: 1,
  end: 4,
  xPct: 50,
  yPct: 28,
  widthPct: 70,
  ...patch,
})

test('text overlays do not add extra ffmpeg inputs', () => {
  const { inputs } = overlayFilter([tx(), ov()], null, 1080, 1920)
  assert.deepEqual(inputs, ['ov0.png'])
})

test('text is drawn with drawtext and images keep their input index', () => {
  const { filter } = overlayFilter([tx(), ov()], null, 1080, 1920)
  assert.match(filter!, /drawtext=fontfile=fonts\/Anton-Regular\.ttf:text='Hello'/)
  assert.match(filter!, /\[1:v\]scale=432:-1/)
  assert.match(filter!, /fontcolor=0xFFFFFF/)
})

test('drawtext escapes quotes, colons and percents', () => {
  assert.equal(escapeDrawtext("it's 50%: ok"), "it'\\''s 50%%\\: ok")
})
