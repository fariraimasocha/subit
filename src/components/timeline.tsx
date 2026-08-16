import { ImagePlus, Minus, Plus, Trash2, Type } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { clusterCues, retimeCluster, type Cue } from '~/lib/cues.ts'
import { clampOverlay, isTextOverlay, MIN_SPAN, type Overlay } from '~/lib/overlays.ts'
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
  onAddText: () => void
  onRemoveOverlay: (id: string) => void
  adding?: boolean
}

const ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp'
/** Discrete px/s rungs above the readable window. Fit is always the zoom-out floor. */
const ZOOMS = [25, 50, 80, 120, 200, 320]
/** Fallback window when there are no cues to measure. */
const WINDOW_S = 10
/** A phrase chip should be at least this wide so a full line can be read. */
const TARGET_BLOCK_W = 200
/** Measured from live chips: 190/31 and 217/37 both sit near 6.2px per character. */
const CHAR_PX = 6.2
const MAX_WINDOW_PPS = 320
/** Grab zone at either end of a block, in px. Below this it is all move. */
const EDGE = 7
const RULER_H = 24
/** Captions need room for text-sm; overlays stay a hair shorter. */
const LANE_H = { cues: 54, images: 48 }
const GUTTER_W = 78

type Zoom = 'fit' | 'window' | number

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
  onAddText,
  onRemoveOverlay,
  adding,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  /** 'window' = readable cue width. 'fit' = whole clip. number = explicit px/s. */
  const [zoom, setZoom] = useState<Zoom>('window')
  const { selectedCueId, selectCue, selectedOverlayId, selectOverlay, patchOverlay, setInspectorTab } = useEditor()

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
  const clusters = useMemo(() => clusterCues(cues), [cues])
  const typicalCue = spanPercentile(
    clusters.map((c) => c.end - c.start),
    0.25,
  )
  const fallbackPps = boxWidth > 0 ? boxWidth / WINDOW_S : 1
  const textPps = clusters.reduce((max, c) => {
    const need = (c.text.length * CHAR_PX) / Math.max(c.end - c.start, 0.2)
    return need > max ? need : max
  }, 0)
  const windowPps =
    boxWidth > 0
      ? Math.min(MAX_WINDOW_PPS, Math.max(fallbackPps, TARGET_BLOCK_W / typicalCue, textPps))
      : 1
  const pps = zoom === 'fit' ? fit : zoom === 'window' ? windowPps : zoom
  const width = Math.max(dur * pps, boxWidth)
  const windowSec = boxWidth > 0 && pps > 0 ? boxWidth / pps : WINDOW_S

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
    const levels: { mode: Zoom; pps: number }[] = [
      { mode: 'fit', pps: fit },
      { mode: 'window', pps: windowPps },
      ...ZOOMS.map((z) => ({ mode: z as Zoom, pps: z })),
    ]
    levels.sort((a, b) => a.pps - b.pps)
    const unique: { mode: Zoom; pps: number }[] = []
    for (const level of levels) {
      if (level.mode !== 'fit' && level.pps <= fit + 0.01) continue
      const last = unique[unique.length - 1]
      if (last && Math.abs(last.pps - level.pps) < 1) continue
      unique.push(level)
    }
    const next =
      dir === 1
        ? unique.find((level) => level.pps > pps + 0.01)?.mode
        : [...unique].reverse().find((level) => level.pps < pps - 0.01)?.mode
    if (next !== undefined) setZoom(next)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-sidebar">
      <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
        <span className="text-sm font-medium">Timeline</span>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          {fmt(dur)}
          {zoom === 'fit' ? ' fitted' : zoom === 'window' ? ` ${Math.max(1, Math.round(windowSec))}s window` : ` at ${zoom} px/s`}
        </span>
        {selectedCueId &&
          (() => {
            const selected = clusters.find((c) => c.ids.includes(selectedCueId))
            if (!selected) return null
            return (
              <span className="ml-3 hidden min-w-0 max-w-md truncate text-xs text-foreground sm:inline" title={selected.text}>
                {selected.text}
              </span>
            )
          })()}

        <div className="ml-auto" />

        <Button size="sm" variant="outline" className="gap-1.5" disabled={dur === 0} onClick={onAddText}>
          <Type className="size-4" />
          Text
        </Button>
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

        {selectedOverlayId &&
          (() => {
            const selected = overlays.find((o) => o.id === selectedOverlayId)
            if (!selected || !isTextOverlay(selected)) return null
            return (
              <input
                type="color"
                aria-label="Text color"
                value={selected.color}
                onChange={(e) => {
                  const next = { ...selected, color: e.target.value.toUpperCase() }
                  patchOverlay(selected.id, next)
                  onOverlayCommit(next)
                }}
                className="h-8 w-10 cursor-pointer rounded-md border border-white/10 bg-transparent p-1"
              />
            )
          })()}

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

        <div className="ml-1 flex items-center rounded-md border border-white/10">
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
        <div className="shrink-0 border-r border-white/10 bg-muted/30" style={{ width: GUTTER_W }}>
          <div className="border-b border-white/10" style={{ height: RULER_H }} />
          <LaneLabel name="Captions" count={cues.length} height={LANE_H.cues} />
          <LaneLabel name="Overlays" count={overlays.length} height={LANE_H.images} />
        </div>

        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width }}>
            {/* Ruler: click or drag anywhere on it to scrub. */}
            <div
              className="relative cursor-pointer border-b border-white/10 bg-muted/30 select-none"
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
                  className="absolute top-0 flex items-center border-l border-white/10 pl-1.5 text-xs tabular-nums text-muted-foreground"
                  style={{ left: t * pps, height: RULER_H }}
                >
                  {label(t)}
                </span>
              ))}
            </div>

            <Lane height={LANE_H.cues}>
              {clusters.map((c) => (
                <Block
                  key={c.id}
                  start={c.start}
                  end={c.end}
                  pps={pps}
                  duration={dur}
                  selected={Boolean(selectedCueId && c.ids.includes(selectedCueId))}
                  className="bg-brand/80 text-brand-foreground hover:bg-brand"
                  onSelect={() => {
                    selectCue(c.id)
                    if (videoRef.current) videoRef.current.currentTime = c.start
                  }}
                  onCommit={(start, end) => onCuesChange(retimeCluster(cues, c.ids, start, end))}
                >
                  <span className="whitespace-nowrap text-sm font-medium">
                    {c.text}
                  </span>
                </Block>
              ))}
            </Lane>

            <Lane height={LANE_H.images}>
              {overlays.length === 0 && (
                <p className="pointer-events-none sticky left-0 flex h-full items-center px-3 text-xs text-muted-foreground">
                  Add text or an image, then drag it on the preview.
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
                  className="bg-ok/25 ring-ok hover:bg-ok/35"
                  onSelect={() => {
                    selectOverlay(o.id)
                    if (o.kind === 'text') setInspectorTab('font')
                  }}
                  onCommit={(start, end) => {
                    const next = clampOverlay({ ...o, start, end }, dur)
                    patchOverlay(o.id, next)
                    onOverlayCommit(next)
                  }}
                >
                  {o.kind === 'text' ? (
                    <span className="truncate text-sm font-medium">{o.text}</span>
                  ) : (
                    <>
                      <img src={o.url} alt="" className="size-6 shrink-0 rounded-xs object-cover" />
                      <span className="truncate text-sm font-medium">{o.name}</span>
                    </>
                  )}
                </Block>
              ))}
            </Lane>

            <div
              ref={headRef}
              className="pointer-events-none absolute top-0 bottom-0 left-0 w-0.5 bg-brand"
              aria-hidden
            >
              <span className="absolute -top-px -left-[5px] size-[11px] rounded-full bg-brand" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LaneLabel({ name, count, height }: { name: string; count: number; height: number }) {
  return (
    <div className="flex flex-col justify-center border-b border-white/10 px-3 last:border-b-0" style={{ height }}>
      <span className="text-xs font-medium">{name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  )
}

function Lane({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div className="relative border-b border-white/10 last:border-b-0" style={{ height }}>
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
        'absolute top-1 bottom-1 z-0 select-none',
        'cursor-grab active:cursor-grabbing hover:z-10',
        selected && 'z-20',
      )}
      style={{ left: start * pps, width: w, touchAction: 'none' }}
    >
      <div
        className={cn('absolute inset-0 rounded-lg', className, selected && 'ring-2 ring-foreground')}
      />
      <span className="pointer-events-none absolute inset-0 z-10 flex items-center gap-1.5 overflow-hidden px-2">
        {children}
      </span>
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Percentile span, so the default zoom sizes a typical phrase chip, not a single word. */
function spanPercentile(values: number[], p: number) {
  if (values.length === 0) return 1
  const spans = values.map((n) => Math.max(n, 0.05)).sort((a, b) => a - b)
  const i = Math.min(spans.length - 1, Math.max(0, Math.floor((spans.length - 1) * p)))
  return spans[i]
}

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
