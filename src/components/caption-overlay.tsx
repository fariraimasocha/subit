import { useEffect, useRef, type RefObject } from 'react'
import type { Cue } from '~/lib/cues.ts'
import { metrics, type Theme } from '~/lib/theme.ts'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  cues: Cue[]
  theme: Theme
  /** True painted height of the video box, from a ResizeObserver on the wrapper. */
  boxHeight: number
  visible: boolean
}

/**
 * Renderer A. Mirrors src/lib/ass.ts through the shared metrics() call, so the
 * only numbers here come from percentages of the on-screen box height.
 *
 * Driven by requestAnimationFrame, not `timeupdate`, which fires roughly four
 * times a second and would visibly lag the word highlight.
 */
export function CaptionOverlay({ videoRef, cues, theme, boxHeight, visible }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const cursor = useRef(0)
  const painted = useRef(-1)

  useEffect(() => {
    painted.current = -1
  }, [cues, theme, boxHeight, visible])

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
      const t = videoRef.current?.currentTime ?? 0

      // ponytail: linear cursor walk, not a binary search. O(n) worst case on a
      // full seek is microseconds at a few thousand cues. Ceiling ~50k cues.
      let i = cursor.current
      if (i >= cues.length || cues[i].start > t) i = 0
      while (i < cues.length - 1 && cues[i].end < t) i++
      cursor.current = i

      const cue = cues[i]
      const active = t >= cue.start && t <= cue.end
      const wordIdx = active ? lastIndexAtOrBefore(cue, t) : -1
      const key = active ? i * 1000 + wordIdx + 1 : -1
      if (key === painted.current) return
      painted.current = key

      if (!active) {
        layer.replaceChildren()
        return
      }

      // Rebuilding the spans is cheaper than diffing three of them, and it only
      // happens when the active word actually changes.
      const frag = document.createDocumentFragment()
      cue.words.forEach((w, j) => {
        const span = document.createElement('span')
        const text = w.text.trim()
        span.textContent = theme.uppercase ? text.toUpperCase() : text
        span.style.color =
          theme.highlightMode === 'color' && j === wordIdx ? theme.highlight : theme.primary
        frag.append(span)
        if (j < cue.words.length - 1) frag.append(document.createTextNode(' '))
      })
      layer.replaceChildren(frag)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cues, theme, boxHeight, visible, videoRef])

  const m = metrics(theme, boxHeight)

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-hidden
    >
      <div
        ref={layerRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: m.centreY,
          transform: 'translate(-50%, -50%)', // matches ASS Alignment 5
          maxWidth: '90%',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          lineHeight: 1.15,
          fontFamily: `'${theme.fontFamily}', sans-serif`,
          fontWeight: theme.weight,
          fontSize: m.fontPx,
          letterSpacing: `${theme.letterSpacingEm}em`,
          // paintOrder reproduces the libass draw order: outline behind fill.
          // WebkitTextStroke is centred on the glyph path while ASS Outline sits
          // outside it, hence the doubling.
          WebkitTextStroke: m.outlinePx > 0 ? `${m.outlinePx * 2}px ${theme.outline}` : undefined,
          paintOrder: 'stroke fill',
          textShadow: m.shadowPx > 0 ? `${m.shadowPx}px ${m.shadowPx}px 0 rgba(0,0,0,0.85)` : undefined,
          backgroundColor: theme.boxColor ?? undefined,
          padding: theme.boxColor ? `${m.fontPx * 0.08}px ${m.fontPx * 0.2}px` : undefined,
        }}
      />
    </div>
  )
}

/** Index of the last word that has started by `t`. Never -1 inside a live cue. */
function lastIndexAtOrBefore(cue: Cue, t: number) {
  let idx = 0
  for (let j = 0; j < cue.words.length; j++) {
    if (cue.words[j].start <= t) idx = j
    else break
  }
  return idx
}
