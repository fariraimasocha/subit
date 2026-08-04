import { Captions, Merge, Scissors } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { editWord, mergeCues, retime, splitCue, type Cue } from '~/lib/cues.ts'
import { EmptyState } from '~/components/empty-state.tsx'
import { cn } from '~/lib/utils.ts'

type Props = {
  cues: Cue[]
  currentTime: number
  onChange: (cues: Cue[]) => void
  onSeek: (t: number) => void
}

/**
 * Every edit is a pure transform from src/lib/cues.ts applied to the whole
 * array, which is then handed up and persisted in one write. Editing a word's
 * text never touches its timing.
 */
export function TranscriptPanel({ cues, currentTime, onChange, onSeek }: Props) {
  const activeIdx = cues.findIndex((c) => currentTime >= c.start && currentTime <= c.end)
  const listRef = useRef<HTMLDivElement>(null)

  /**
   * Follow the playhead by scrolling THIS list only.
   *
   * scrollIntoView walks up and scrolls every scrollable ancestor including the
   * document, so during playback each new cue dragged the whole page down and
   * slid the video preview off the top of the screen. Setting scrollTop cannot
   * escape the container.
   */
  useEffect(() => {
    const list = listRef.current
    if (activeIdx < 0 || !list) return
    const el = list.querySelector<HTMLElement>(`[data-cue-index="${activeIdx}"]`)
    if (!el) return

    const top = el.offsetTop
    const bottom = top + el.offsetHeight
    // Only move when the row has actually left the visible band, so a cue in
    // the middle of the list does not cause a scroll on every word.
    if (top < list.scrollTop) list.scrollTop = top
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight
  }, [activeIdx])

  if (cues.length === 0) {
    return (
      <EmptyState
        icon={Captions}
        title="No transcript yet"
        body="Cues appear here once transcription finishes. You can then fix any misheard word, split a cue or nudge its timing."
        className="py-10"
      />
    )
  }

  return (
    // relative so a row's offsetTop is measured against this list rather than
    // some ancestor, which is what the scroll maths above assumes.
    <div ref={listRef} className="relative max-h-[60vh] space-y-1 overflow-y-auto pr-1 xl:h-full xl:max-h-none">
      {cues.map((cue, i) => (
        <div
          key={cue.id}
          data-cue-index={i}
          className={cn(
            'group rounded-lg border p-2 transition-colors',
            i === activeIdx ? 'border-foreground/60 bg-accent' : 'border-transparent hover:border-border',
          )}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSeek(cue.start)}
              className="w-14 shrink-0 text-left font-mono text-xs tabular-nums text-muted-foreground hover:text-foreground"
            >
              {fmt(cue.start)}
            </button>

            <div className="flex flex-1 flex-wrap items-center gap-1">
              {cue.words.map((w, wi) => (
                <WordInput
                  key={wi}
                  value={w.text}
                  onCommit={(text) => text !== w.text && onChange(editWord(cues, cue.id, wi, text))}
                  onSplit={
                    wi < cue.words.length - 1 ? () => onChange(splitCue(cues, cue.id, wi)) : undefined
                  }
                />
              ))}
            </div>

            <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Merge with the next cue"
                disabled={i === cues.length - 1}
                onClick={() => onChange(mergeCues(cues, cue.id))}
              >
                <Merge className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Nudge this cue 100ms later"
                onClick={() => onChange(retime(cues, cue.id, cue.start + 0.1, cue.end + 0.1))}
              >
                <span className="text-xs">+</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                aria-label="Nudge this cue 100ms earlier"
                disabled={cue.start < 0.1}
                onClick={() => onChange(retime(cues, cue.id, cue.start - 0.1, cue.end - 0.1))}
              >
                <span className="text-xs">-</span>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Commits on blur or Enter, so a keystroke does not fire a mutation per letter. */
function WordInput({
  value,
  onCommit,
  onSplit,
}: {
  value: string
  onCommit: (text: string) => void
  onSplit?: () => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <span className="inline-flex items-center">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        // An empty word would burn a blank span, so revert instead of committing.
        onBlur={() => (draft.trim() ? onCommit(draft.trim()) : setDraft(value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setDraft(value)
        }}
        className="h-7 w-auto min-w-12 border-transparent bg-transparent px-1.5 text-sm shadow-none focus-visible:border-input"
        style={{ width: `${Math.max(3, draft.length + 1)}ch` }}
      />
      {onSplit && (
        <button
          type="button"
          onClick={onSplit}
          aria-label="Split the cue after this word"
          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        >
          <Scissors className="size-3" />
        </button>
      )}
    </span>
  )
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`
}
