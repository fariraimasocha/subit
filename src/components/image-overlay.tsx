import { useEffect, useRef, type RefObject } from 'react'
import { clampOverlay, type Overlay } from '~/lib/overlays.ts'
import { useEditor } from '~/store/editor.ts'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  overlays: Overlay[]
  /** Clip length, so a drag cannot push an image past the end. */
  duration: number
  /** Persist the moved or resized overlay. Omit to make the images inert. */
  onCommit?: (o: Overlay) => void
}

/** Bottom-right resize handle, in px. */
const HANDLE = 14

/**
 * Renderer A for images. Mirrors src/lib/overlays.ts: left/top are the CENTRE of
 * the image as a percentage of the box, exactly what the ffmpeg overlay=x:y
 * expression computes, so the preview and the burn land in the same place.
 *
 * React renders each <img> once. Showing and hiding them is done by a single
 * requestAnimationFrame loop writing style.visibility, never by state, so
 * playback does not rerender the editor sixty times a second.
 */
export function ImageOverlay({ videoRef, overlays, duration, onCommit }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const { patchOverlay, selectedOverlayId, selectOverlay } = useEditor()
  // Resolved once on pointerdown, like the caption drag. `id` is the pointerId,
  // which is what stops a second finger hijacking the first one's drag.
  const drag = useRef<{ id: number; mode: 'move' | 'size'; box: DOMRect; o: Overlay } | null>(null)

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
        // Reading first keeps this a no-op write on the frames nothing changed.
        if (node.style.visibility !== want) node.style.visibility = want
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoRef, overlays])

  const draggable = Boolean(onCommit)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, o: Overlay, mode: 'move' | 'size') => {
    // Left button only: a right click would start a drag the context menu then
    // leaves stranded.
    if (!draggable || drag.current || e.button !== 0) return
    const box = layerRef.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return
    e.stopPropagation()
    selectOverlay(o.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, mode, box, o }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    const x = ((e.clientX - d.box.left) / d.box.width) * 100
    const y = ((e.clientY - d.box.top) / d.box.height) * 100
    // Resizing from the corner: the width is twice the distance to the centre,
    // because the image is centred on x/y and grows both ways.
    const next =
      d.mode === 'move'
        ? { ...d.o, xPct: x, yPct: y }
        : { ...d.o, widthPct: Math.abs(x - d.o.xPct) * 2 }
    d.o = clampOverlay(next, duration)
    patchOverlay(d.o.id, d.o)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    onCommit?.(d.o)
  }

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {overlays.map((o) => {
        const selected = draggable && o.id === selectedOverlayId
        return (
          <div
            key={o.id}
            data-start={o.start}
            data-end={o.end}
            onPointerDown={(e) => onPointerDown(e, o, 'move')}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className={draggable ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : undefined}
            style={{
              position: 'absolute',
              left: `${o.xPct}%`,
              top: `${o.yPct}%`,
              width: `${o.widthPct}%`,
              transform: 'translate(-50%, -50%)',
              visibility: 'hidden',
              // Without this a touch drag scrolls the page instead of moving the image.
              touchAction: draggable ? 'none' : undefined,
              outline: selected ? '1px solid rgba(255,255,255,0.9)' : undefined,
            }}
          >
            <img src={o.url} alt="" draggable={false} className="block w-full select-none" />
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
  )
}
