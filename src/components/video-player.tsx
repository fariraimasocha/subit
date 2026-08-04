import { ChevronDown, Eye, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaptionOverlay } from '~/components/caption-overlay.tsx'
import { ImageOverlay } from '~/components/image-overlay.tsx'
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
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
]

const RATIOS: Record<Exclude<Aspect, 'source'>, number> = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 }
const SPEEDS = [0.5, 1, 1.5, 2]

/**
 * Everything stacked above and below the preview that also has to fit on
 * screen: the editor header, the page padding, the frame control row, the
 * transport row, the timeline and the gaps between them. Overshooting only
 * shrinks the preview slightly; undershooting pushes the timeline off the
 * bottom.
 */
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
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boxHeight, setBoxHeight] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const { aspect, setAspect, captionsVisible, setCaptionsVisible } = useEditor()

  // Letterboxing would make the measured height wrong, so it is killed
  // structurally: the wrapper owns the aspect ratio and the video fills it.
  // One ResizeObserver then reports the true painted height.
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoxHeight(entry.contentRect.height))
    ro.observe(el)
    setBoxHeight(el.getBoundingClientRect().height)
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

  const ratio = aspect === 'source' ? width / height : RATIOS[aspect]

  return (
    <div className="space-y-3">
      {/*
        The box is sized by capping its WIDTH, because aspect-ratio then derives
        the height, and an over-tall preview is the failure mode that matters: a
        9:16 clip is 1.78x taller than it is wide. width = height * ratio, so to
        keep the height inside the viewport the width cap has to be the
        available height times the ratio. Deriving the cap from a flat fraction
        of vh instead gave a 9:16 box 105vh tall, pushing its own transport
        controls off the bottom of the screen.
      */}
      <div
        className="mx-auto w-full"
        style={{
          // The max() floor matters: below CHROME_PX of viewport the calc goes
          // negative and the preview would collapse to nothing. Better to
          // overflow and let the page scroll than to vanish.
          maxWidth: `min(100%, max(220px, calc((100dvh - ${CHROME_PX}px) * ${ratio})))`,
        }}
      >
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
          <CaptionOverlay
            videoRef={videoRef}
            cues={cues}
            theme={theme}
            boxHeight={boxHeight}
            visible={captionsVisible}
            onCommit={onPositionCommit}
          />
        </div>
      </div>

      {/* Frame controls: what the video looks like, not where it is playing. */}
      <div className="flex flex-wrap items-center gap-1">
        <Menu label={aspect === 'source' ? 'Source' : aspect}>
          {ASPECTS.map((a) => (
            <MenuItem key={a.value} active={aspect === a.value} onClick={() => setAspect(a.value)}>
              {a.label}
            </MenuItem>
          ))}
        </Menu>

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
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            const next = !muted
            setMuted(next)
            if (videoRef.current) videoRef.current.muted = next
          }}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
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

      {/* Transport: play head and time. */}
      <div className="flex items-center gap-3">
        <Button size="icon" variant="secondary" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {fmt(time)} / {fmt(duration)}
        </span>

        <Slider
          className="flex-1"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.01}
          value={[time]}
          onValueChange={([v]) => seek(v)}
        />
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
