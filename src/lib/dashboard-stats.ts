import type { Project, ProjectStatus } from '~/lib/project.ts'

const DAY = 86_400_000
const WEEK = 7 * DAY

export type WeekPoint = { week: string; count: number }
export type StatusPoint = { label: string; count: number }
export type HeatCell = {
  key: string
  count: number
  week: number
  day: number
  label: string
}

export type DashboardStats = {
  total: number
  ready: number
  inFlight: number
  exported: number
  failed: number
  weekly: WeekPoint[]
  statusBars: StatusPoint[]
  heatmap: HeatCell[]
  heatmapTotal: number
  monthLabels: { week: number; label: string }[]
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  uploaded: 'Queued',
  processing: 'Transcribing',
  ready: 'Ready',
  exporting: 'Exporting',
  done: 'Exported',
  error: 'Failed',
}

function startOfDay(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeek(ms: number) {
  const d = new Date(startOfDay(ms))
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d.getTime()
}

function weekLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function monthLabel(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short' })
}

/** Studio numbers derived from the project list the dashboard already loads. */
export function dashboardStats(projects: Project[], now = Date.now()): DashboardStats {
  const ready = projects.filter((p) => p.status === 'ready').length
  const inFlight = projects.filter(
    (p) => p.status === 'uploaded' || p.status === 'processing' || p.status === 'exporting',
  ).length
  const exported = projects.filter((p) => p.status === 'done').length
  const failed = projects.filter((p) => p.status === 'error').length

  const counts = new Map<ProjectStatus, number>()
  for (const p of projects) counts.set(p.status, (counts.get(p.status) ?? 0) + 1)
  const statusBars: StatusPoint[] = (
    ['ready', 'done', 'processing', 'uploaded', 'exporting', 'error'] as const
  )
    .map((status) => ({ label: STATUS_LABEL[status], count: counts.get(status) ?? 0 }))
    .filter((row) => row.count > 0)

  const weekStart = startOfWeek(now)
  const weekly: WeekPoint[] = Array.from({ length: 12 }, (_, i) => {
    const start = weekStart - (11 - i) * WEEK
    const end = start + WEEK
    return {
      week: weekLabel(start),
      count: projects.filter((p) => p.created_at >= start && p.created_at < end).length,
    }
  })

  const heatStart = weekStart - 19 * WEEK
  const heatmap: HeatCell[] = []
  const monthLabels: { week: number; label: string }[] = []
  let lastMonth = ''
  for (let week = 0; week < 20; week += 1) {
    const colStart = heatStart + week * WEEK
    const month = monthLabel(colStart)
    if (month !== lastMonth) {
      monthLabels.push({ week, label: month })
      lastMonth = month
    }
    for (let day = 0; day < 7; day += 1) {
      const dayStart = colStart + day * DAY
      const dayEnd = dayStart + DAY
      const count = projects.filter((p) => p.created_at >= dayStart && p.created_at < dayEnd).length
      heatmap.push({
        key: `${week}-${day}`,
        count,
        week,
        day,
        label: new Date(dayStart).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      })
    }
  }

  return {
    total: projects.length,
    ready,
    inFlight,
    exported,
    failed,
    weekly,
    statusBars: statusBars.length ? statusBars : [{ label: 'Ready', count: 0 }],
    heatmap,
    heatmapTotal: heatmap.reduce((n, cell) => n + cell.count, 0),
    monthLabels,
  }
}
