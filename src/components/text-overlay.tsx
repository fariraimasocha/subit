import { useEffect, useRef, type RefObject } from 'react'
import {
  AlignmentGuides,
  applyAlignmentGuides,
  hideAlignmentGuides,
  snapOverlayAxes,
} from '~/components/alignment-guides.tsx'
import { clampOverlay, isTextOverlay, type Overlay, type TextOverlayData } from '~/lib/overlays.ts'
import { useEditor } from '~/store/editor.ts'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  overlays: Overlay[]
  boxHeight: number
  duration: number
  onCommit?: (o: Overlay) => void
}

const HANDLE = 14

/**
 * Renderer A for placed text. Same centre-percent coordinates as images, so a
 * drag here and the drawtext burn land on the same spot.
 */
export function TextOverlay({ videoRef, overlays, boxHeight, duration, onCommit }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const guidesRef = useRef<HTMLDivElement>(null)
  const { patchOverlay, selectedOverlayId, selectOverlay } = useEditor()
  const drag = useRef<{
    id: number
    mode: 'move' | 'size'
    box: DOMRect
    o: TextOverlayData
  } | null>(null)
  const texts = overlays.filter(isTextOverlay)
  const draggable = Boolean(onCommit)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const layer = layerRef.current
      if (!layer) return
      const t = videoRef.current?.currentTime ?? 0
      for (const el of layer.children) {
        const node = el as HTMLElement
        const on = t >= Number(node.dataset.start) && t <= Number(node.dataset.end)
        const want = on ? 'visible' : 'hidden'
        if (node.style.visibility !== want) node.style.visibility = want
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoRef, texts])

  useEffect(() => {
    if (drag.current) return
    const selected = texts.find((o) => o.id === selectedOverlayId)
    if (!selected) {
      hideAlignmentGuides(guidesRef.current)
      return
    }
    const snap = snapOverlayAxes(selected.xPct, selected.yPct)
    applyAlignmentGuides(guidesRef.current, snap.snappedX, snap.snappedY)
  }, [texts, selectedOverlayId])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, o: TextOverlayData, mode: 'move' | 'size') => {
    if (!draggable || drag.current || e.button !== 0) return
    const box = layerRef.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return
    e.stopPropagation()
    selectOverlay(o.id)
    useEditor.getState().setInspectorTab('font')
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, mode, box, o }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    const x = ((e.clientX - d.box.left) / d.box.width) * 100
    const y = ((e.clientY - d.box.top) / d.box.height) * 100
    let next: TextOverlayData
    if (d.mode === 'move') {
      const snap = snapOverlayAxes(x, y)
      applyAlignmentGuides(guidesRef.current, snap.snappedX, snap.snappedY)
      next = { ...d.o, xPct: snap.xPct, yPct: snap.yPct }
    } else {
      next = {
        ...d.o,
        widthPct: Math.abs(x - d.o.xPct) * 2,
        fontSizePct: Math.max(2, d.o.fontSizePct * (Math.abs(x - d.o.xPct) * 2) / Math.max(d.o.widthPct, 1)),
      }
    }
    d.o = clampOverlay(next, duration) as TextOverlayData
    patchOverlay(d.o.id, d.o)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    drag.current = null
    hideAlignmentGuides(guidesRef.current)
    e.currentTarget.releasePointerCapture(e.pointerId)
    onCommit?.(d.o)
  }

  return (
    <>
      <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {texts.map((o) => {
        const selected = draggable && o.id === selectedOverlayId
        const fontPx = boxHeight > 0 ? (o.fontSizePct / 100) * boxHeight : 24
        return (
          <div
            key={o.id}
            data-start={o.start}
            data-end={o.end}
            onPointerDown={(e) => onPointerDown(e, o, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={(e) => {
              e.stopPropagation()
              const el = e.currentTarget.querySelector('[data-text]')
              if (el instanceof HTMLElement) {
                el.contentEditable = 'true'
                el.focus()
              }
            }}
            className={draggable ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : undefined}
            style={{
              position: 'absolute',
              left: `${o.xPct}%`,
              top: `${o.yPct}%`,
              width: `${o.widthPct}%`,
              transform: 'translate(-50%, -50%)',
              visibility: 'hidden',
              touchAction: draggable ? 'none' : undefined,
              outline: selected ? '1px solid rgba(255,255,255,0.9)' : undefined,
            }}
          >
            <div
              data-text
              className="select-none text-center leading-tight"
              style={{
                fontFamily: `'${o.fontFamily}', sans-serif`,
                fontSize: `${fontPx}px`,
                color: o.color,
                WebkitTextStroke: `${Math.max(0, fontPx * 0.08)}px #000`,
                paintOrder: 'stroke fill',
                wordBreak: 'break-word',
              }}
              onPointerDown={(e) => {
                if ((e.currentTarget as HTMLElement).contentEditable === 'true') e.stopPropagation()
              }}
              onBlur={(e) => {
                const next = e.currentTarget.textContent?.trim() || 'Text'
                e.currentTarget.contentEditable = 'false'
                if (next === o.text) return
                const updated = { ...o, text: next, name: next.slice(0, 40) }
                patchOverlay(o.id, updated)
                onCommit?.(updated)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
            >
              {o.text}
            </div>
            {selected && (
              <div
                onPointerDown={(e) => onPointerDown(e, o, 'size')}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                aria-hidden
                className="absolute rounded-sm border border-black/40 bg-white"
                style={{
                  width: HANDLE,
                  height: HANDLE,
                  right: -HANDLE / 2,
                  bottom: -HANDLE / 2,
                  cursor: 'nwse-resize',
                  touchAction: 'none',
                }}
              />
            )}
          </div>
        )
      })}
      </div>
      <AlignmentGuides rootRef={guidesRef} />
    </>
  )
}
