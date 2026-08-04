import { ImagePlus, Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { retime, type Cue } from '~/lib/cues.ts'
import { clampOverlay, MIN_SPAN, type Overlay } from '~/lib/overlays.ts'
import { cn } from '~/lib/utils.ts'
import { useEditor } from '~/store/editor.ts'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  cues: Cue[]
  overlays: Overlay[]
  duration: number
  /** Committed on pointerup only: this is a D1 write. */
  onCuesChange: (cues: Cue[]) => void
  onOverlayCommit: (o: Overlay) => void
  onAddImage: (file: File) => void
  onRemoveOverlay: (id: string) => void
  adding?: boolean
}

const ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'
const ZOOMS = [10, 20, 50, 100, 200]
/** Grab zone at either end of a block, in px. Below this it is all move. */
const EDGE = 7
const RULER_H = 24
/** Images get the taller lane: their block carries a thumbnail, a cue's is text. */
const LANE_H = { cues: 34, images: 44 }
/** Below this a label is one squashed letter per block, so the bar goes bare. */
const LABEL_MIN_W = 36
const GUTTER_W = 78

/**
 * The editing surface. Two lanes over a shared time ruler: captions, which write
 * back through retime(), and images, which write back through the store.
 *
 * Nothing on the 60fps path goes through React. The playhead is moved by writing
 * a transform on a ref, and a block being dragged has its own style written
 * directly until the pointer comes up, which is the only moment state changes.
 */
export function Timeline({
  videoRef,
  cues,
  overlays,
  duration,
  onCuesChange,
  onOverlayCommit,
  onAddImage,
  onRemoveOverlay,
  adding,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  /** null means fit the whole clip in the box. */
  const [zoom, setZoom] = useState<number | null>(null)
  const { selectedCueId, selectCue, selectedOverlayId, selectOverlay, patchOverlay } = useEditor()

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width))
    ro.observe(el)
    setBoxWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const dur = duration > 0 ? duration : 0
  const fit = dur > 0 && boxWidth > 0 ? boxWidth / dur : 1
  const pps = zoom ?? fit
  const width = Math.max(dur * pps, boxWidth)

  // The playhead is the one thing that moves every frame, so it is the one thing
  // that never touches React.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const head = headRef.current
      const scroll = scrollRef.current
      if (!head || !scroll) return
      const x = (videoRef.current?.currentTime ?? 0) * pps
      head.style.transform = `translateX(${x}px)`
      // Follow only while playing: doing it during a scrub would fight the user
      // for control of the scroll position.
      if (videoRef.current?.paused !== false) return
      if (x < scroll.scrollLeft || x > scroll.scrollLeft + scroll.clientWidth - 24) {
        scroll.scrollLeft = x - scroll.clientWidth / 2
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoRef, pps])

  const seek = (clientX: number) => {
    const track = scrollRef.current
    const v = videoRef.current
    if (!track || !v) return
    const x = clientX - track.getBoundingClientRect().left + track.scrollLeft
    v.currentTime = Math.min(dur, Math.max(0, x / pps))
  }

  const zoomBy = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z > pps + 0.01)
    const next = dir === 1 ? (i < 0 ? null : ZOOMS[i]) : ZOOMS.filter((z) => z < pps - 0.01).pop() ?? null
    setZoom(next)
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <span className="text-sm font-medium">Timeline</span>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          {fmt(dur)}
          {zoom ? ` at ${zoom} px/s` : ' fitted'}
        </span>

        <div className="ml-auto" />

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={adding || dur === 0}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {adding ? 'Uploading' : 'Image'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Reset so picking the same file twice fires change again.
            e.target.value = ''
            if (file) onAddImage(file)
          }}
        />

        {selectedOverlayId && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => onRemoveOverlay(selectedOverlayId)}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        )}

        <div className="ml-1 flex items-center rounded-md border">
          <Button size="icon" variant="ghost" className="size-8" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
            <Minus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" aria-label="Zoom in" onClick={() => zoomBy(1)}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Lane names sit outside the scroller, so there is no scroll to sync. */}
        <div className="shrink-0 border-r bg-muted/30" style={{ width: GUTTER_W }}>
          <div className="border-b" style={{ height: RULER_H }} />
          <LaneLabel name="Captions" count={cues.length} height={LANE_H.cues} />
          <LaneLabel name="Images" count={overlays.length} height={LANE_H.images} />
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width }}>
            {/* Ruler: click or drag anywhere on it to scrub. */}
            <div
              className="relative cursor-pointer border-b bg-muted/30 select-none"
              style={{ height: RULER_H }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                seek(e.clientX)
              }}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && seek(e.clientX)}
            >
              {ticks(dur, pps).map((t) => (
                <span
                  key={t}
                  className="absolute top-0 flex items-center border-l border-border/70 pl-1.5 text-[10px] tabular-nums text-muted-foreground"
                  style={{ left: t * pps, height: RULER_H }}
                >
                  {label(t)}
                </span>
              ))}
            </div>

            <Lane height={LANE_H.cues}>
              {cues.map((c) => (
                <Block
                  key={c.id}
                  start={c.start}
                  end={c.end}
                  pps={pps}
                  duration={dur}
                  selected={c.id === selectedCueId}
                  className="bg-foreground/20 hover:bg-foreground/30"
                  onSelect={() => {
                    selectCue(c.id)
                    if (videoRef.current) videoRef.current.currentTime = c.start
                  }}
                  onCommit={(start, end) => onCuesChange(retime(cues, c.id, start, end))}
                >
                  <span className="truncate px-1 text-[11px]">
                    {c.words.map((w) => w.text.trim()).join(' ')}
                  </span>
                </Block>
              ))}
            </Lane>

            <Lane height={LANE_H.images}>
              {overlays.length === 0 && (
                <p className="pointer-events-none sticky left-0 flex h-full items-center px-3 text-xs text-muted-foreground">
                  No images yet. Add one and drag it where you want it.
                </p>
              )}
              {overlays.map((o) => (
                <Block
                  key={o.id}
                  start={o.start}
                  end={o.end}
                  pps={pps}
                  duration={dur}
                  selected={o.id === selectedOverlayId}
                  className="bg-sky-500/25 ring-sky-300 hover:bg-sky-500/35"
                  onSelect={() => selectOverlay(o.id)}
                  onCommit={(start, end) => {
                    const next = clampOverlay({ ...o, start, end }, dur)
                    patchOverlay(o.id, next)
                    onOverlayCommit(next)
                  }}
                >
                  <img src={o.url} alt="" className="size-6 shrink-0 rounded-xs object-cover" />
                  <span className="truncate text-[11px]">{o.name}</span>
                </Block>
              ))}
            </Lane>

            <div
              ref={headRef}
              className="pointer-events-none absolute top-0 bottom-0 left-0 w-px bg-red-500"
              aria-hidden
            >
              <span className="absolute -top-px -left-[3px] size-[7px] rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LaneLabel({ name, count, height }: { name: string; count: number; height: number }) {
  return (
    <div className="flex flex-col justify-center border-b px-3 last:border-b-0" style={{ height }}>
      <span className="text-xs font-medium">{name}</span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
    </div>
  )
}

function Lane({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="relative border-b border-border/60 last:border-b-0" style={{ height }}>
      {children}
    </div>
  )
}

type BlockProps = {
  start: number
  end: number
  pps: number
  duration: number
  selected: boolean
  className: string
  onSelect: () => void
  /** Fired on pointerup only. Everything before that is a style write. */
  onCommit: (start: number, end: number) => void
  children: React.ReactNode
}

/**
 * One draggable span on a lane. Body drags move it, the last EDGE px at either
 * end trim it. The element's own left/width are written during the drag and left
 * for React to overwrite on the commit rerender, which is what keeps hundreds of
 * cue blocks off the pointermove path.
 */
function Block({ start, end, pps, duration, selected, className, onSelect, onCommit, children }: BlockProps) {
  const drag = useRef<{ id: number; mode: 'move' | 'start' | 'end'; x: number; start: number; end: number } | null>(
    null,
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || e.button !== 0) return
    onSelect()
    const box = e.currentTarget.getBoundingClientRect()
    // A block narrower than three grab zones is all move, or it becomes
    // impossible to slide at low zoom.
    const edge = box.width > EDGE * 3 ? EDGE : 0
    const mode =
      e.clientX - box.left < edge ? 'start' : box.right - e.clientX < edge ? 'end' : 'move'
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, mode, x: e.clientX, start, end }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    const dt = (e.clientX - d.x) / pps
    const span = end - start
    if (d.mode === 'move') {
      d.start = clamp(start + dt, 0, Math.max(0, duration - span))
      d.end = d.start + span
    } else if (d.mode === 'start') {
      d.start = clamp(start + dt, 0, end - MIN_SPAN)
      d.end = end
    } else {
      d.start = start
      d.end = clamp(end + dt, start + MIN_SPAN, duration || end + dt)
    }
    e.currentTarget.style.left = `${d.start * pps}px`
    e.currentTarget.style.width = `${(d.end - d.start) * pps}px`
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d?.id !== e.pointerId) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (d.start !== start || d.end !== end) onCommit(d.start, d.end)
  }

  // A hairline off the right edge, so back to back cues read as separate blocks
  // instead of one continuous grey bar at fit zoom.
  const w = Math.max((end - start) * pps - 1, 3)

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'absolute top-1 bottom-1 flex items-center gap-1.5 overflow-hidden rounded-md px-1 select-none',
        'cursor-grab active:cursor-grabbing',
        selected && 'ring-2 ring-foreground',
        className,
      )}
      style={{ left: start * pps, width: w, touchAction: 'none' }}
    >
      {/* Under this width a label is one clipped letter per block, which reads
          as noise. The bar alone says when, and zooming in brings the text back. */}
      {w >= LABEL_MIN_W && children}
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Tick times spaced so labels never collide, whatever the zoom. */
function ticks(duration: number, pps: number) {
  if (duration <= 0 || pps <= 0) return []
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * pps >= 56) ?? 600
  const out: number[] = []
  for (let t = 0; t <= duration; t += step) out.push(Math.round(t * 10) / 10)
  return out
}

/** Whole seconds, for the clip length in the header. */
const fmt = (s: number) => label(Math.round(s))

/** m:ss, or m:ss.s once the ruler is zoomed past one tick a second. */
function label(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  const whole = Number.isInteger(sec)
  return `${m}:${String(Math.floor(sec)).padStart(2, '0')}${whole ? '' : `.${Math.round((sec % 1) * 10)}`}`
}
