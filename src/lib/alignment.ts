/** Magnetic window, in % of the frame. Matches Figma-ish "near enough" snap. */
export const SNAP_PCT = 1.2
export const GUIDE_CENTER = 50
export const GUIDE_THIRDS = [33, 67] as const
export const SNAP_TARGETS = [GUIDE_CENTER, ...GUIDE_THIRDS] as const

export type SnapHit = {
  value: number
  snapped: number | null
}

export type OverlaySnap = {
  xPct: number
  yPct: number
  snappedX: number | null
  snappedY: number | null
}

/** Snap `pct` onto the nearest target when the pointer is inside SNAP_PCT. */
export function snapPct(pct: number, targets: readonly number[] = SNAP_TARGETS): SnapHit {
  let hit: number | null = null
  let best = SNAP_PCT
  for (const t of targets) {
    const d = Math.abs(pct - t)
    if (d < best) {
      best = d
      hit = t
    }
  }
  return hit === null ? { value: pct, snapped: null } : { value: hit, snapped: hit }
}

export function snapOverlayAxes(xPct: number, yPct: number): OverlaySnap {
  const x = snapPct(xPct)
  const y = snapPct(yPct)
  return { xPct: x.value, yPct: y.value, snappedX: x.snapped, snappedY: y.snapped }
}
