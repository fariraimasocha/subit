import { Pause, Play, Subtitles } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaptionOverlay } from '~/components/caption-overlay.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import type { Cue } from '~/lib/cues.ts'
import type { Theme } from '~/lib/theme.ts'
import { useEditor, type Aspect } from '~/store/editor.ts'

type Props = {
  src: string
  /** Owned by the editor so the transcript panel can seek. */
  videoRef: React.RefObject<HTMLVideoElement | null>
  width: number
  height: number
  cues: Cue[]
  theme: Theme
  onTimeChange?: (t: number) => void
}

const ASPECTS: { value: Aspect; label: string }[] = [
  { value: 'source', label: 'Source' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
]

const RATIOS: Record<Exclude<Aspect, 'source'>, number> = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 }

export function VideoPlayer({ src, videoRef, width, height, cues, theme, onTimeChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [boxHeight, setBoxHeight] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
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

  const ratio = aspect === 'source' ? width / height : RATIOS[aspect]

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full" style={{ maxWidth: ratio >= 1 ? '100%' : `${70 * ratio + 20}vh` }}>
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
            onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())}
          />
          <CaptionOverlay
            videoRef={videoRef}
            cues={cues}
            theme={theme}
            boxHeight={boxHeight}
            visible={captionsVisible}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="secondary"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => (videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause())}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {fmt(time)} / {fmt(duration)}
        </span>

        <Slider
          className="flex-1"
          min={0}
          max={Math.max(duration, 0.1)}
          step={0.01}
          value={[time]}
          onValueChange={([v]) => {
            if (videoRef.current) videoRef.current.currentTime = v
            setTime(v)
          }}
        />

        <Button
          size="icon"
          variant={captionsVisible ? 'secondary' : 'ghost'}
          aria-label="Toggle captions"
          aria-pressed={captionsVisible}
          onClick={() => setCaptionsVisible(!captionsVisible)}
        >
          <Subtitles className="size-4" />
        </Button>
      </div>

      <div className="flex gap-1">
        {ASPECTS.map((a) => (
          <Button
            key={a.value}
            size="sm"
            variant={aspect === a.value ? 'secondary' : 'ghost'}
            onClick={() => setAspect(a.value)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function fmt(s: number) {
  if (!Number.isFinite(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
