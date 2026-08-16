import { useEffect, useRef, type RefObject } from 'react'
import {
  AlignmentGuides,
  applyAlignmentGuides,
  hideAlignmentGuides,
  noteCaptionSnapChange,
  snapPct,
} from '~/components/alignment-guides.tsx'
import type { Cue } from '~/lib/cues.ts'
import { boxPaddingPx, CAPTION_LINE_HEIGHT, metrics, themePaintKey, type Theme } from '~/lib/theme.ts'
import { useEditor } from '~/store/editor.ts'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  cues: Cue[]
  /** True painted height of the video box, from a ResizeObserver on the wrapper. */
  boxHeight: number
  visible: boolean
  /** Persist the dragged position. Omit to make the caption undraggable. */
  onCommit?: (pct: number) => void
}

/** Every visual field both renderers read, so any style tweak invalidates the cache. */
function applyLayerStyle(layer: HTMLDivElement, t: Theme, height: number, skipTop = false) {
  const m = metrics(t, height)
  if (!skipTop) layer.style.top = `${m.centreY}px`
  layer.style.fontFamily = `'${t.fontFamily}', sans-serif`
  layer.style.fontWeight = String(t.weight)
  layer.style.fontSize = `${m.fontPx}px`
  layer.style.letterSpacing = `${t.letterSpacingEm}em`
  // BorderStyle 3 cannot stroke and box at once. Drop the CSS stroke when boxed
  // so a custom box on a Hormozi-style preset matches the burn.
  layer.style.webkitTextStroke =
    !t.boxColor && m.outlinePx > 0 ? `${m.outlinePx * 2}px ${t.outline}` : ''
  layer.style.textShadow =
    !t.boxColor && m.shadowPx > 0 ? `${m.shadowPx}px ${m.shadowPx}px 0 rgba(0,0,0,0.85)` : ''
  layer.style.backgroundColor = t.boxColor ?? ''
  if (t.boxColor) {
    const pad = boxPaddingPx(m.fontPx)
    layer.style.padding = `${pad.block}px ${pad.inline}px`
  } else {
    layer.style.padding = ''
  }
}

/**
 * Renderer A. Mirrors src/lib/ass.ts through the shared metrics() call, so the
 * only numbers here come from percentages of the on-screen box height.
 *
 * Driven by requestAnimationFrame, not `timeupdate`, which fires roughly four
 * times a second and would visibly lag the word highlight.
 */
export function CaptionOverlay({ videoRef, cues, boxHeight, visible, onCommit }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const guidesRef = useRef<HTMLDivElement>(null)
  const cursor = useRef(0)
  const painted = useRef<string | null>(null)
  const measuredHeight = useRef(0)
  const drag = useRef<{ id: number; box: DOMRect; offset: number; pct: number; snapY: number | null } | null>(null)
  const patchTheme = useEditor((s) => s.patchTheme)
  const draggable = Boolean(onCommit) && visible

  useEffect(() => {
    painted.current = null
  }, [cues, boxHeight, visible])

  useEffect(() => {
    if (!visible || cues.length === 0) {
      if (layerRef.current) layerRef.current.replaceChildren()
      return
    }

    let raf = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const layer = layerRef.current
      if (!layer) return

      if (boxHeight > 0) measuredHeight.current = boxHeight
      const height = measuredHeight.current
      if (!height) return

      const t = videoRef.current?.currentTime ?? 0
      const playing = Boolean(videoRef.current && !videoRef.current.paused && !videoRef.current.ended)
      const { theme: liveTheme, selectedCueId } = useEditor.getState()

      applyLayerStyle(layer, liveTheme, height, Boolean(drag.current))

      // ponytail: linear cursor walk, not a binary search. O(n) worst case on a
      // full seek is microseconds at a few thousand cues. Ceiling ~50k cues.
      let i = cursor.current
      if (i >= cues.length || cues[i].start > t) i = 0
      while (i < cues.length - 1 && cues[i].end < t) i++
      cursor.current = i

      const atPlayhead = cues[i]
      const playheadActive = t >= atPlayhead.start && t <= atPlayhead.end

      let showCue: (typeof cues)[number] | undefined
      let showWordIdx = 0
      let showing = false

      if (playing) {
        // During playback the preview must follow the playhead, same as the export burn.
        if (playheadActive) {
          showCue = atPlayhead
          showWordIdx = lastIndexAtOrBefore(atPlayhead, t)
          showing = true
        }
      } else {
        // Paused: keep the selected cue visible so style presets are easy to compare.
        const selected = selectedCueId ? cues.find((c) => c.id === selectedCueId) : undefined
        showCue = selected ?? (playheadActive ? atPlayhead : undefined) ?? cues[0]
        showing = Boolean(showCue)
        if (showCue) {
          const inRange = t >= showCue.start && t <= showCue.end
          showWordIdx = inRange ? lastIndexAtOrBefore(showCue, t) : 0
        }
      }

      const key = showing
        ? `${themePaintKey(liveTheme)}:${showCue!.id}:${showWordIdx}:${playing ? 'play' : 'pause'}`
        : `idle:${themePaintKey(liveTheme)}:${playing ? 'play' : 'pause'}`
      if (key === painted.current) return
      painted.current = key

      if (!showing) {
        layer.replaceChildren()
        return
      }

      const frag = document.createDocumentFragment()
      showCue!.words.forEach((w, j) => {
        const span = document.createElement('span')
        const text = w.text.trim()
        span.textContent = liveTheme.uppercase ? text.toUpperCase() : text
        span.style.color =
          liveTheme.highlightMode === 'color' && j === showWordIdx
            ? liveTheme.highlight
            : liveTheme.primary
        frag.append(span)
        if (j < showCue!.words.length - 1) frag.append(document.createTextNode(' '))
      })
      layer.replaceChildren(frag)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cues, boxHeight, visible, videoRef])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable || drag.current || e.button !== 0) return
    const block = e.currentTarget.getBoundingClientRect()
    const box = e.currentTarget.parentElement?.getBoundingClientRect()
    if (!box?.height) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      id: e.pointerId,
      box,
      offset: block.top + block.height / 2 - e.clientY,
      pct: useEditor.getState().theme.positionPct,
      snapY: null,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    const raw = clamp(((e.clientY + d.offset - d.box.top) / d.box.height) * 100, 5, 95)
    const snap = snapPct(raw)
    d.pct = snap.value
    applyAlignmentGuides(guidesRef.current, null, snap.snapped)
    noteCaptionSnapChange(d, raw, snap.snapped)
    // Write the overlay directly. Going through the store here rerendered the
    // whole editor on every pointermove and made the caption lag the cursor.
    if (layerRef.current) layerRef.current.style.top = `${(d.pct / 100) * d.box.height}px`
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    drag.current = null
    hideAlignmentGuides(guidesRef.current)
    e.currentTarget.releasePointerCapture(e.pointerId)
    patchTheme({ positionPct: d.pct })
    onCommit?.(d.pct)
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-hidden
    >
      <div
        ref={layerRef}
        className={draggable ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '90%',
          touchAction: draggable ? 'none' : undefined,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          lineHeight: CAPTION_LINE_HEIGHT,
          paintOrder: 'stroke fill',
        }}
      />
      <AlignmentGuides rootRef={guidesRef} />
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Index of the last word that has started by `t`. Never -1 inside a live cue. */
function lastIndexAtOrBefore(cue: Cue, t: number) {
  let idx = 0
  for (let j = 0; j < cue.words.length; j++) {
    if (cue.words[j].start <= t) idx = j
    else break
  }
  return idx
}
