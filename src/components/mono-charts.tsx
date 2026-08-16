import { areaY, defineChart, lineY } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/react'
import { treemap } from '@tanstack/charts/hierarchy/treemap'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { useMemo, type ReactNode } from 'react'
import type { DashboardStats, HeatCell, StatusPoint, WeekPoint } from '~/lib/dashboard-stats.ts'
import { cn } from '~/lib/utils.ts'

const MONO_THEME = {
  foreground: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  grid: 'color-mix(in oklab, var(--border-1) 28%, transparent)',
  background: 'transparent',
  palette: ['var(--text-primary)'],
} as const

function ChartCard({
  eyebrow,
  title,
  value,
  hint,
  children,
  className,
}: {
  eyebrow: string
  title: string
  value: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col rounded-3xl border border-white/8 bg-surface-2 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.22em] text-text-muted uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        <p className="font-mono text-sm tabular-nums text-text-secondary">{value}</p>
      </div>
      <div className="mt-5 min-h-0 flex-1">{children}</div>
      {hint ? <p className="mt-4 text-xs text-text-muted">{hint}</p> : null}
    </section>
  )
}

function heatTone(count: number) {
  if (count <= 0) return 'bg-white/6'
  if (count === 1) return 'bg-foreground/35'
  if (count === 2) return 'bg-foreground/60'
  return 'bg-foreground'
}

export function ActivityHeatmap({ stats }: { stats: DashboardStats }) {
  return (
    <ChartCard
      eyebrow="Activity heatmap"
      title="Studio cadence"
      value={`${stats.heatmapTotal} uploads`}
      hint="20 weeks by 7 days. Each tile is a day you sent a clip."
    >
      <div className="flex gap-2">
        <div className="grid shrink-0 grid-rows-7 content-around py-0.5 font-mono text-[10px] leading-none text-text-muted">
          <span>S</span>
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative mb-2 h-4">
            {stats.monthLabels.map((m) => (
              <span
                key={`${m.week}-${m.label}`}
                className="absolute font-mono text-[11px] text-text-muted"
                style={{ left: `${(m.week / 20) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div
            className="grid w-full grid-flow-col grid-rows-7 gap-1"
            style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }}
          >
            {stats.heatmap.map((cell: HeatCell) => (
              <span
                key={cell.key}
                title={`${cell.label}: ${cell.count} upload${cell.count === 1 ? '' : 's'}`}
                className={cn(
                  'aspect-square min-w-0 rounded-full transition-colors',
                  heatTone(cell.count),
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  )
}

export function UploadWave({ weekly }: { weekly: WeekPoint[] }) {
  const peak = Math.max(...weekly.map((w) => w.count), 0)
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(weekly, {
            x: 'week',
            y: 'count',
            fill: 'url(#subit-wave)',
          }),
          lineY(weekly, {
            x: 'week',
            y: 'count',
            stroke: 'var(--text-primary)',
            strokeWidth: 2.5,
            points: true,
          }),
        ],
        x: {
          scale: () => scalePoint<string>().padding(0.15),
          grid: false,
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: false,
        },
        gradients: [
          {
            id: 'subit-wave',
            x1: 0,
            y1: 1,
            x2: 0,
            y2: 0,
            stops: [
              { offset: 0, color: 'var(--text-primary)', opacity: 0.02 },
              { offset: 1, color: 'var(--text-primary)', opacity: 0.28 },
            ],
          },
        ],
        theme: MONO_THEME,
        tooltip,
        clip: true,
      }),
    [weekly],
  )

  return (
    <ChartCard
      eyebrow="Spline dynamics"
      title="Uploads by week"
      value={`${peak} peak`}
      hint="Rounded wave of clips you sent in the last 12 weeks."
    >
      <Chart
        definition={definition}
        height={220}
        initialWidth={560}
        ariaLabel="Uploads by week"
        className="text-text-secondary"
      />
    </ChartCard>
  )
}

const TILE_FILLS = ['#f4f4f5', '#a1a1aa', '#52525b', '#27272a', '#18181b', '#09090b'] as const
const TILE_INKS = ['#18181b', '#18181b', '#f4f4f5', '#f4f4f5', '#f4f4f5', '#f4f4f5'] as const

export function StatusTreemap({ rows }: { rows: StatusPoint[] }) {
  const built = rows.reduce((n, row) => n + row.count, 0)
  const ranked = [...rows].sort((a, b) => b.count - a.count)
  const source = useMemo(
    () =>
      ranked.map((row) => ({
        path: `studio/${row.label}`,
        count: Math.max(row.count, built === 0 ? 1 : 0),
        label: row.label,
      })),
    [ranked, built],
  )
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          treemap(source, {
            path: 'path',
            value: 'count',
            paddingInner: 10,
            radius: 18,
            fill: (node) => {
              if (!node.external) return 'transparent'
              const i = ranked.findIndex((row) => row.label === node.name)
              return TILE_FILLS[Math.max(0, i)] ?? TILE_FILLS[TILE_FILLS.length - 1]
            },
            label: (node) => {
              if (!node.external) return null
              const pct = built === 0 ? 0 : Math.round((node.value / built) * 100)
              return `${node.name} ${pct}%`
            },
            labelFill: (node) => {
              const i = ranked.findIndex((row) => row.label === node.name)
              return TILE_INKS[Math.max(0, i)] ?? TILE_INKS[TILE_INKS.length - 1]
            },
            labelFontSize: 14,
            labelFontWeight: 600,
            labelPadding: 12,
          }),
        ],
        theme: MONO_THEME,
        tooltip,
      }),
    [source, ranked, built],
  )

  return (
    <ChartCard
      eyebrow="Tile treemap"
      title="Where clips sit"
      value="100% partitioned"
      hint={`Rounded corner tiles. ${ranked.length} status partition${ranked.length === 1 ? '' : 's'}.`}
    >
      <Chart
        definition={definition}
        height={220}
        initialWidth={420}
        ariaLabel="Projects partitioned by status"
        className="text-text-secondary"
      />
    </ChartCard>
  )
}

export function StatKpi({
  label,
  value,
  weekly,
}: {
  label: string
  value: number
  weekly: WeekPoint[]
}) {
  const max = Math.max(...weekly.map((w) => w.count), 1)
  return (
    <article className="rounded-3xl border border-white/8 bg-surface-2 p-5">
      <p className="font-mono text-[11px] font-semibold tracking-[0.22em] text-text-muted uppercase">
        {label}
      </p>
      <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <div className="mt-5 flex h-9 items-end gap-1">
        {weekly.map((w) => (
          <span
            key={w.week}
            title={`${w.week}: ${w.count}`}
            className="flex-1 rounded-full bg-foreground/80"
            style={{ height: `${Math.max(12, (w.count / max) * 100)}%` }}
          />
        ))}
      </div>
    </article>
  )
}
