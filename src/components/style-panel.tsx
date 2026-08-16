import { Label } from '~/components/ui/label.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import { Switch } from '~/components/ui/switch.tsx'
import { Select } from '@cloudflare/kumo/components/select'
import { FONTS, metrics, THEMES, type Theme } from '~/lib/theme.ts'
import { cn } from '~/lib/utils.ts'

export type StylePane = 'presets' | 'font' | 'layout' | 'all'

type Props = {
  theme: Theme
  onChange: (patch: Partial<Theme>) => void
  onPreset: (t: Theme) => void
  /** Encoded video height, so the px readout matches what actually gets burned. */
  videoHeight: number
  /** Which inspector rail tab this instance is filling. */
  pane?: StylePane
}

/**
 * Presets scroll, controls stay pinned to the bottom. Picking a look and then
 * nudging its size and position is one loop, so the nudges must not scroll away
 * the moment the preset list gets long.
 *
 * Adding a preset is a data entry in THEMES, never new code in here.
 */
const TITLES: Record<StylePane, string> = {
  all: 'CAPTION STYLE',
  presets: 'STYLES',
  font: 'FONT',
  layout: 'LAYOUT',
}

export function StylePanel({ theme, onChange, onPreset, videoHeight, pane = 'all' }: Props) {
  const m = metrics(theme, videoHeight || 1080)
  const showPresets = pane === 'all' || pane === 'presets'
  const showFont = pane === 'all' || pane === 'font'
  const showLayout = pane === 'all' || pane === 'layout'

  return (
    // flex-1 rather than h-full: the Card is capped by max-height with an auto
    // height, and a percentage height against an auto parent resolves to auto, so
    // h-full would let the panel overflow the cap instead of scrolling inside it.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-text-muted">{TITLES[pane]}</h2>
        <span className="text-xs text-muted-foreground">{theme.name}</span>
      </div>

      {showPresets && (
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* Two columns, not the reference's three: that grid exists to page
            through ~30 presets, and at five it only truncates the names. */}
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPreset(t)}
              aria-pressed={theme.id === t.id}
              className={cn(
                'flex h-14 items-center justify-center rounded-lg border bg-surface-1 px-1.5 transition-colors',
                theme.id === t.id
                  ? 'border-brand ring-1 ring-brand'
                  : 'border-white/10 hover:border-white/20',
              )}
            >
              <span
                className="truncate text-sm"
                style={{
                  fontFamily: `'${t.fontFamily}', sans-serif`,
                  color: t.highlight,
                  textTransform: t.uppercase ? 'uppercase' : 'none',
                  WebkitTextStroke: t.outlinePct ? `${t.outlinePct * 2}px ${t.outline}` : undefined,
                  paintOrder: 'stroke fill',
                  backgroundColor: t.boxColor ?? undefined,
                  padding: t.boxColor ? '1px 5px' : undefined,
                }}
              >
                {t.name}
              </span>
            </button>
          ))}
        </div>

        {/* Spacing separates these from the grid, so they need no boxes of their
            own. A bordered row around a switch is two separators doing one job. */}
        <div className="mt-6 space-y-1">
          <div className="flex items-center justify-between py-1.5">
            <Label htmlFor="uppercase" className="cursor-pointer text-sm font-normal">
              Uppercase
            </Label>
            <Switch
              id="uppercase"
              checked={theme.uppercase}
              onCheckedChange={(v) => onChange({ uppercase: v })}
            />
          </div>
          <div className="flex items-center justify-between py-1.5">
            <Label htmlFor="box" className="cursor-pointer text-sm font-normal">
              Background box
            </Label>
            <Switch
              id="box"
              checked={theme.boxColor !== null}
              onCheckedChange={(v) => onChange({ boxColor: v ? '#000000' : null })}
            />
          </div>
        </div>
      </div>
      )}

      {showLayout && (
        <div className={cn('space-y-3 p-4', showPresets && 'border-t border-white/10', !showFont && 'flex-1')}>
          <Field label="Position Y" value={`${theme.positionPct.toFixed(0)} %`}>
            <Slider
              min={5}
              max={95}
              step={1}
              value={[theme.positionPct]}
              onValueChange={(v) => onChange({ positionPct: v[0] })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            Drag the caption on the preview, or use this slider. Position is the centre of the block.
          </p>
        </div>
      )}

      {showFont && (
      <div className={cn('shrink-0 space-y-3 p-4', (showPresets || showLayout) && 'border-t border-white/10')}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Font size" value={`${Math.round(m.fontPx)} px`}>
            <Slider
              min={2}
              max={16}
              step={0.1}
              value={[theme.fontSizePct]}
              onValueChange={(v) => onChange({ fontSizePct: v[0] })}
            />
          </Field>

          <Field label="Outline" value={`${m.outlinePx.toFixed(1)} px`}>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[theme.outlinePct]}
              onValueChange={(v) => onChange({ outlinePct: v[0] })}
            />
          </Field>

          <Field label="Shadow" value={`${m.shadowPx.toFixed(1)} px`}>
            <Slider
              min={0}
              max={1.5}
              step={0.05}
              value={[theme.shadowPct]}
              onValueChange={(v) => onChange({ shadowPct: v[0] })}
            />
          </Field>
        </div>

        <div className="space-y-3 pt-1">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Font</Label>
            <Select
              className="h-9 !w-full min-w-0 max-w-full overflow-hidden border-white/10 bg-surface-3"
              value={theme.fontFamily}
              onValueChange={(family) => {
                if (!family) return
                const f = FONTS.find((x) => x.family === family)
                if (f) onChange({ fontFamily: f.family, fontFile: f.file })
              }}
              items={Object.fromEntries(FONTS.map((f) => [f.family, f.family]))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Swatch label="Main" value={theme.primary} onChange={(v) => onChange({ primary: v })} />
            <Swatch label="Second" value={theme.highlight} onChange={(v) => onChange({ highlight: v })} />
            <Swatch label="Third" value={theme.outline} onChange={(v) => onChange({ outline: v })} />
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
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
