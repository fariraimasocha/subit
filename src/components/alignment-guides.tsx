import { memo, type CSSProperties, type RefObject } from 'react'
import { GUIDE_CENTER, GUIDE_THIRDS } from '~/lib/alignment.ts'

export {
  GUIDE_CENTER,
  GUIDE_THIRDS,
  SNAP_PCT,
  SNAP_TARGETS,
  snapOverlayAxes,
  snapPct,
  type OverlaySnap,
  type SnapHit,
} from '~/lib/alignment.ts'

const LINE = 'rgba(56, 189, 248, 0.9)'
const LINE_SOFT = 'rgba(56, 189, 248, 0.55)'

export type OverlaySnapMem = {
  snapX: number | null
  snapY: number | null
}

export type CaptionSnapMem = {
  snapY: number | null
}

/**
 * Toggle guide lines by writing display on the existing nodes. React must not
 * own this: overlay drags already patch the store every move, and a useState
 * here would double that 60fps render path.
 */
export function applyAlignmentGuides(
  root: HTMLElement | null,
  snappedX: number | null,
  snappedY: number | null,
) {
  if (!root) return
  for (const el of root.children) {
    const node = el as HTMLElement
    const axis = node.dataset.guideAxis
    const at = Number(node.dataset.guideAt)
    const on = axis === 'v' ? snappedX === at : axis === 'h' ? snappedY === at : false
    const want = on ? 'block' : 'none'
    if (node.style.display !== want) node.style.display = want
  }
}

export function hideAlignmentGuides(root: HTMLElement | null) {
  applyAlignmentGuides(root, null, null)
}

export function noteOverlaySnapChange(
  mem: OverlaySnapMem,
  kind: 'text' | 'image',
  xPct: number,
  yPct: number,
  snappedX: number | null,
  snappedY: number | null,
) {
  if (mem.snapX === snappedX && mem.snapY === snappedY) return
  mem.snapX = snappedX
  mem.snapY = snappedY
  if (snappedX === null && snappedY === null) return
}

export function noteCaptionSnapChange(mem: CaptionSnapMem, positionPct: number, snapped: number | null) {
  if (mem.snapY === snapped) return
  mem.snapY = snapped
  if (snapped === null) return
}

const labelStyle: CSSProperties = {
  position: 'absolute',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.06em',
  lineHeight: 1,
  color: LINE,
  textShadow: '0 0 4px rgba(0,0,0,0.75)',
  userSelect: 'none',
}

/**
 * Static guide nodes. Visibility is flipped from pointermove via
 * applyAlignmentGuides, not from props, so parent rerenders cannot flicker them.
 */
export const AlignmentGuides = memo(function AlignmentGuides({
  rootRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <>
      <style>{`.alignment-guides-root>[data-guide-axis]{display:none}`}</style>
      <div
        ref={rootRef}
        className="alignment-guides-root pointer-events-none absolute inset-0 z-20 overflow-hidden"
        aria-hidden
      >
        <div
          data-guide-axis="v"
          data-guide-at={GUIDE_CENTER}
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: LINE,
            transform: 'translateX(-50%)',
          }}
        >
          <span style={{ ...labelStyle, top: 8, left: 4 }}>Y</span>
        </div>
        <div
          data-guide-axis="h"
          data-guide-at={GUIDE_CENTER}
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: LINE,
            transform: 'translateY(-50%)',
          }}
        >
          <span style={{ ...labelStyle, left: 8, top: 4 }}>X</span>
        </div>
        {GUIDE_THIRDS.map((at) => (
          <div
            key={`v-${at}`}
            data-guide-axis="v"
            data-guide-at={at}
            style={{
              position: 'absolute',
              left: `${at}%`,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: LINE_SOFT,
              transform: 'translateX(-50%)',
            }}
          />
        ))}
        {GUIDE_THIRDS.map((at) => (
          <div
            key={`h-${at}`}
            data-guide-axis="h"
            data-guide-at={at}
            style={{
              position: 'absolute',
              top: `${at}%`,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: LINE_SOFT,
              transform: 'translateY(-50%)',
            }}
          />
        ))}
      </div>
    </>
  )
})
