import { ChevronDown, Eye, Maximize2, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaptionOverlay } from '~/components/caption-overlay.tsx'
import { ImageOverlay } from '~/components/image-overlay.tsx'
import { TextOverlay } from '~/components/text-overlay.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Label } from '~/components/ui/label.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import { Switch } from '~/components/ui/switch.tsx'
import type { Cue } from '~/lib/cues.ts'
import type { Overlay } from '~/lib/overlays.ts'
import type { Theme } from '~/lib/theme.ts'
import { cn } from '~/lib/utils.ts'
import { useEditor, type Aspect } from '~/store/editor.ts'

type Props = {
  src: string
  /** Owned by the editor so the transcript panel can seek. */
  videoRef: React.RefObject<HTMLVideoElement | null>
  width: number
  height: number
  cues: Cue[]
  theme: Theme
  overlays: Overlay[]
  onTimeChange?: (t: number) => void
  /** Persist a caption position dragged on the preview. */
  onPositionCommit?: (pct: number) => void
  /** Persist an image moved or resized on the preview. */
  onOverlayCommit?: (o: Overlay) => void
  /** Timeline sits between the preview and the transport, matching the reference workspace. */
  children?: React.ReactNode
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
]

const RATIOS: Record<Exclude<Aspect, 'source'>, number> = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 }
const SPEEDS = [0.5, 1, 1.5, 2]
/** Header, timeline, transport. Same budget the preview used before the slot fill. */
const CHROME_PX = 400

export function VideoPlayer({
  src,
  videoRef,
  width,
  height,
  cues,
  theme,
  overlays,
  onTimeChange,
  onPositionCommit,
  onOverlayCommit,
  children,
}: Props) {
  const slotRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState({ w: 0, h: 0 })
  const [boxHeight, setBoxHeight] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [speed, setSpeed] = useState(1)
  const { aspect, setAspect, captionsVisible, setCaptionsVisible } = useEditor()

  // The preview slot is the remaining column after the timeline and transport
  // take their height. Size the video from those measured pixels, not cqh:
  // @container is inline-size only, so 100cqh was 0 and a 9:16 clip took the
  // full column width, then aspect-ratio pushed it down through the timeline.
  useLayoutEffect(() => {
    const slotEl = slotRef.current
    const wrapEl = wrapRef.current
    if (!slotEl) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === slotEl) {
          setSlot({ w: entry.contentRect.width, h: entry.contentRect.height })
        }
        if (entry.target === wrapEl) {
          setBoxHeight(entry.contentRect.height)
        }
      }
    })
    ro.observe(slotEl)
    if (wrapEl) ro.observe(wrapEl)
    setSlot({ w: slotEl.clientWidth, h: slotEl.clientHeight })
    if (wrapEl) setBoxHeight(wrapEl.clientHeight)
    return () => ro.disconnect()
  }, [])

  // The scrubber only needs a few updates a second. currentTime deliberately
  // stays out of zustand and out of the overlay's render path.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setTime(v.currentTime)
      onTimeChange?.(v.currentTime)
    }
    const onMeta = () => setDuration(v.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [onTimeChange])

  const toggle = () => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())
  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t
    setTime(t)
  }
  const skip = (dt: number) => seek(Math.min(Math.max((videoRef.current?.currentTime ?? 0) + dt, 0), duration || 0))

  const ratio = aspect === 'source' ? width / height : RATIOS[aspect]
  // Fit the whole frame inside the slot, then cap to the old viewport budget so
  // a tall leftover column cannot stretch a 9:16 clip into a cropped landscape box.
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight
  const maxH = Math.max(160, Math.min(slot.h || viewportH, viewportH - CHROME_PX))
  const previewWidth = Math.min(slot.w || maxH * ratio, maxH * ratio)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={slotRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pt-4"
      >
        <div className="max-w-full" style={{ width: `${previewWidth}px` }}>
        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-xl bg-black"
          style={{ aspectRatio: `${ratio}` }}
        >
          <video
            ref={videoRef}
            src={src}
            playsInline
            className="block h-full w-full"
            style={{ objectFit: aspect === 'source' ? 'contain' : 'cover' }}
            onClick={toggle}
          />
          {/* Images first: later siblings paint on top, and the export chains
              the subtitles filter after the overlays for the same reason. */}
          <ImageOverlay
            videoRef={videoRef}
            overlays={overlays}
            duration={duration}
            onCommit={onOverlayCommit}
          />
          <TextOverlay
            videoRef={videoRef}
            overlays={overlays}
            boxHeight={boxHeight}
            duration={duration}
            onCommit={onOverlayCommit}
          />
          <CaptionOverlay
            videoRef={videoRef}
            cues={cues}
            boxHeight={boxHeight}
            visible={captionsVisible}
            onCommit={onPositionCommit}
          />
        </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 px-4 pt-2">
        <Menu label={aspect === 'source' ? 'Source' : aspect}>
          {ASPECTS.map((a) => (
            <MenuItem key={a.value} active={aspect === a.value} onClick={() => setAspect(a.value)}>
              {a.label}
            </MenuItem>
          ))}
        </Menu>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Eye className="size-4" />
              Display
              <ChevronDown className="size-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56">
            <p className="mb-3 text-xs text-muted-foreground">Display</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="captions-toggle" className="cursor-pointer text-sm font-normal">
                Captions
              </Label>
              <Switch id="captions-toggle" checked={captionsVisible} onCheckedChange={setCaptionsVisible} />
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => seek(0)}
          aria-label="Back to the start"
        >
          <RotateCcw className="size-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          aria-label="Fullscreen"
          onClick={() => videoRef.current?.requestFullscreen?.()}
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>

      {children}

      <div className="shrink-0 space-y-2 border-t border-white/10 px-4 py-3">
        <Slider
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.01}
          value={[time]}
          onValueChange={([v]) => seek(v)}
        />
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                const next = !muted
                setMuted(next)
                if (videoRef.current) videoRef.current.muted = next
              }}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Slider
              className="hidden max-w-24 sm:flex"
              min={0}
              max={1}
              step={0.01}
              value={[muted ? 0 : volume]}
              onValueChange={([v]) => {
                setVolume(v)
                setMuted(v === 0)
                if (videoRef.current) {
                  videoRef.current.volume = v
                  videoRef.current.muted = v === 0
                }
              }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" className="size-8" aria-label="Back two seconds" onClick={() => skip(-2)}>
              <SkipBack className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="size-11 rounded-full"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={toggle}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Forward two seconds" onClick={() => skip(2)}>
              <SkipForward className="size-4" />
            </Button>
            <span className="ml-1 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {fmt(time)} / {fmt(duration)}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end">
            <Menu label={`${speed}x`}>
              {SPEEDS.map((s) => (
                <MenuItem
                  key={s}
                  active={speed === s}
                  onClick={() => {
                    setSpeed(s)
                    if (videoRef.current) videoRef.current.playbackRate = s
                  }}
                >
                  {s}x
                </MenuItem>
              ))}
            </Menu>
          </div>
        </div>
      </div>
    </div>
  )
}

function Menu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          {label}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-32 p-1">
        {children}
      </PopoverContent>
    </Popover>
  )
}

function MenuItem({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
        active && 'font-medium',
      )}
    >
      {children}
    </button>
  )
}

/** m:ss.cc, matching the precision the transcript panel edits at. */
function fmt(s: number) {
  if (!Number.isFinite(s)) return '0:00.00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${m}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
