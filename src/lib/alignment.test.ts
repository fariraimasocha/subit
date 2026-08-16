import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapOverlayAxes, snapPct, SNAP_PCT } from './alignment.ts'

test('snapPct leaves values outside the magnetic window alone', () => {
  const hit = snapPct(50 + SNAP_PCT + 0.01)
  assert.equal(hit.snapped, null)
  assert.equal(hit.value, 50 + SNAP_PCT + 0.01)
})

test('snapPct locks onto center and thirds', () => {
  assert.deepEqual(snapPct(50.4), { value: 50, snapped: 50 })
  assert.deepEqual(snapPct(32.2), { value: 33, snapped: 33 })
  assert.deepEqual(snapPct(67.1), { value: 67, snapped: 67 })
})

test('snapOverlayAxes snaps each axis independently', () => {
  const both = snapOverlayAxes(49.2, 66.1)
  assert.deepEqual(both, { xPct: 50, yPct: 67, snappedX: 50, snappedY: 67 })
  const xOnly = snapOverlayAxes(50, 28)
  assert.deepEqual(xOnly, { xPct: 50, yPct: 28, snappedX: 50, snappedY: null })
})
