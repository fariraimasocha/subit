import { Label } from '~/components/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select.tsx'
import { Slider } from '~/components/ui/slider.tsx'
import { FONTS, metrics, THEMES, type Theme } from '~/lib/theme.ts'
import { cn } from '~/lib/utils.ts'

type Props = {
  theme: Theme
  onChange: (patch: Partial<Theme>) => void
  onPreset: (t: Theme) => void
  /** Encoded video height, so the px readout matches what actually gets burned. */
  videoHeight: number
}

/** Adding a preset is a data entry in THEMES, never new code in here. */
export function StylePanel({ theme, onChange, onPreset, videoHeight }: Props) {
  const m = metrics(theme, videoHeight || 1080)

  return (
    <div className="space-y-6">
      <div>
        <Label className="mb-3 block">Caption style</Label>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPreset(t)}
              className={cn(
                'flex h-16 items-center justify-center rounded-lg border bg-neutral-900 px-2 transition-colors',
                theme.id === t.id ? 'border-foreground' : 'border-border hover:border-foreground/40',
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
      </div>

      <Field label="Caption position" value={`${theme.positionPct.toFixed(0)}%`}>
        <Slider
          min={5}
          max={95}
          step={1}
          value={[theme.positionPct]}
          onValueChange={([v]) => onChange({ positionPct: v })}
        />
      </Field>

      <Field label="Font size" value={`${Math.round(m.fontPx)}px`}>
        <Slider
          min={2}
          max={16}
          step={0.1}
          value={[theme.fontSizePct]}
          onValueChange={([v]) => onChange({ fontSizePct: v })}
        />
      </Field>

      <Field label="Outline" value={`${m.outlinePx.toFixed(1)}px`}>
        <Slider
          min={0}
          max={2}
          step={0.05}
          value={[theme.outlinePct]}
          onValueChange={([v]) => onChange({ outlinePct: v })}
        />
      </Field>

      <div className="space-y-2">
        <Label>Font</Label>
        <Select
          value={theme.fontFamily}
          onValueChange={(family) => {
            const f = FONTS.find((x) => x.family === family)
            if (f) onChange({ fontFamily: f.family, fontFile: f.file })
          }}
        >
          <SelectTrigger className="w-full">
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

      <div className="grid grid-cols-3 gap-3">
        <Swatch label="Main" value={theme.primary} onChange={(v) => onChange({ primary: v })} />
        <Swatch label="Second" value={theme.highlight} onChange={(v) => onChange({ highlight: v })} />
        <Swatch label="Third" value={theme.outline} onChange={(v) => onChange({ outline: v })} />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="uppercase" className="cursor-pointer">
          Uppercase
        </Label>
        <input
          id="uppercase"
          type="checkbox"
          className="size-4 accent-foreground"
          checked={theme.uppercase}
          onChange={(e) => onChange({ uppercase: e.target.checked })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="box" className="cursor-pointer">
          Background box
        </Label>
        <input
          id="box"
          type="checkbox"
          className="size-4 accent-foreground"
          checked={theme.boxColor !== null}
          onChange={(e) => onChange({ boxColor: e.target.checked ? '#000000' : null })}
        />
      </div>
    </div>
  )
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      {children}
    </div>
  )
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
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
