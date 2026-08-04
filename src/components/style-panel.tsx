import { Label } from '~/components/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import { Switch } from '~/components/ui/switch.tsx'
import { FONTS, metrics, THEMES, type Theme } from '~/lib/theme.ts'
import { cn } from '~/lib/utils.ts'

type Props = {
  theme: Theme
  onChange: (patch: Partial<Theme>) => void
  onPreset: (t: Theme) => void
  /** Encoded video height, so the px readout matches what actually gets burned. */
  videoHeight: number
}

/**
 * Presets scroll, controls stay pinned to the bottom. Picking a look and then
 * nudging its size and position is one loop, so the nudges must not scroll away
 * the moment the preset list gets long.
 *
 * Adding a preset is a data entry in THEMES, never new code in here.
 */
export function StylePanel({ theme, onChange, onPreset, videoHeight }: Props) {
  const m = metrics(theme, videoHeight || 1080)

  return (
    // flex-1 rather than h-full: the Card is capped by max-height with an auto
    // height, and a percentage height against an auto parent resolves to auto, so
    // h-full would let the panel overflow the cap instead of scrolling inside it.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-medium">Caption style</h2>
        <span className="text-xs text-muted-foreground">{theme.name}</span>
      </div>

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
                'flex h-14 items-center justify-center rounded-lg border bg-video-surface px-1.5 transition-colors',
                theme.id === t.id
                  ? 'border-foreground ring-1 ring-foreground'
                  : 'border-border hover:border-foreground/40',
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

      {/* Two per row, so position and size sit side by side the way the whole
          nudge loop actually gets used. */}
      <div className="shrink-0 space-y-3 border-t p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Position" value={`${theme.positionPct.toFixed(0)} %`}>
            <Slider
              min={5}
              max={95}
              step={1}
              value={[theme.positionPct]}
              onValueChange={([v]) => onChange({ positionPct: v })}
            />
          </Field>

          <Field label="Font size" value={`${Math.round(m.fontPx)} px`}>
            <Slider
              min={2}
              max={16}
              step={0.1}
              value={[theme.fontSizePct]}
              onValueChange={([v]) => onChange({ fontSizePct: v })}
            />
          </Field>

          <Field label="Outline" value={`${m.outlinePx.toFixed(1)} px`}>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[theme.outlinePct]}
              onValueChange={([v]) => onChange({ outlinePct: v })}
            />
          </Field>

          <Field label="Shadow" value={`${m.shadowPx.toFixed(1)} px`}>
            <Slider
              min={0}
              max={1.5}
              step={0.05}
              value={[theme.shadowPct]}
              onValueChange={([v]) => onChange({ shadowPct: v })}
            />
          </Field>
        </div>

        <div className="flex items-end gap-3 pt-1">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Font</Label>
            <Select
              value={theme.fontFamily}
              onValueChange={(family) => {
                const f = FONTS.find((x) => x.family === family)
                if (f) onChange({ fontFamily: f.family, fontFile: f.file })
              }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((f) => (
                  <SelectItem key={f.family} value={f.family}>
                    <span style={{ fontFamily: `'${f.family}', sans-serif` }}>{f.family}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Swatch label="Main" value={theme.primary} onChange={(v) => onChange({ primary: v })} />
          <Swatch label="Second" value={theme.highlight} onChange={(v) => onChange({ highlight: v })} />
          <Swatch label="Third" value={theme.outline} onChange={(v) => onChange({ outline: v })} />
        </div>
      </div>
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
    <div className="w-14 shrink-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-full cursor-pointer rounded-md border bg-transparent p-1"
      />
    </div>
  )
}
