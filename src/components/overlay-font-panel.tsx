import { type ReactNode } from 'react'
import { Label } from '~/components/ui/label.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import { Select } from '@cloudflare/kumo/components/select'
import { FONTS } from '~/lib/theme.ts'
import type { TextOverlayData } from '~/lib/overlays.ts'

export type OverlayFontPane = 'font' | 'layout'

type Props = {
  overlay: TextOverlayData
  /** Encoded video height, so the px readout matches the burn. */
  videoHeight: number
  onChange: (patch: Partial<TextOverlayData>) => void
  pane?: OverlayFontPane
}

const TITLES: Record<OverlayFontPane, string> = {
  font: 'TEXT FONT',
  layout: 'TEXT LAYOUT',
}

function truncate(s: string, n = 28) {
  return s.length > n ? `${s.slice(0, n)}...` : s
}

/**
 * Inspector for one placed text overlay. Caption Theme stays in StylePanel;
 * this pane only writes the selected overlay's own font and position fields.
 */
export function OverlayFontPanel({ overlay, videoHeight, onChange, pane = 'font' }: Props) {
  const height = videoHeight || 1080
  const fontPx = Math.round((overlay.fontSizePct / 100) * height)
  const showFont = pane === 'font'
  const showLayout = pane === 'layout'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-text-muted">{TITLES[pane]}</h2>
        <span className="max-w-[50%] truncate text-xs text-muted-foreground">{truncate(overlay.text)}</span>
      </div>

      {showFont && (
        <div className="shrink-0 space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Selected text</p>
          <Field label="Font size" value={`${fontPx} px`}>
            <Slider
              min={2}
              max={16}
              step={0.1}
              value={[overlay.fontSizePct]}
              onValueChange={(v) => onChange({ fontSizePct: v[0] })}
            />
          </Field>

          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Font</Label>
            <Select
              className="h-9 !w-full min-w-0 max-w-full overflow-hidden border-white/10 bg-surface-3"
              value={overlay.fontFamily}
              onValueChange={(family) => {
                if (!family) return
                const f = FONTS.find((x) => x.family === family)
                if (f) onChange({ fontFamily: f.family, fontFile: f.file })
              }}
              items={Object.fromEntries(FONTS.map((f) => [f.family, f.family]))}
            />
          </div>

          <Swatch
            label="Color"
            value={overlay.color}
            onChange={(color) => onChange({ color })}
          />
        </div>
      )}

      {showLayout && (
        <div className="flex-1 space-y-3 p-4">
          <p className="text-xs text-muted-foreground">Selected text</p>
          <Field label="Position X" value={`${overlay.xPct.toFixed(0)} %`}>
            <Slider
              min={5}
              max={95}
              step={1}
              value={[overlay.xPct]}
              onValueChange={(v) => onChange({ xPct: v[0] })}
            />
          </Field>
          <Field label="Position Y" value={`${overlay.yPct.toFixed(0)} %`}>
            <Slider
              min={5}
              max={95}
              step={1}
              value={[overlay.yPct]}
              onValueChange={(v) => onChange({ yPct: v[0] })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Drag the text on the preview, or use these sliders. Position is the centre of the block.
          </p>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  )
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-full cursor-pointer rounded-md border border-white/10 bg-transparent p-1"
      />
    </div>
  )
}
