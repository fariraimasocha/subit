import { UploadSimple } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clapperboard } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '~/components/empty-state.tsx'
import { ActivityHeatmap, StatKpi, StatusTreemap, UploadWave } from '~/components/mono-charts.tsx'
import { ProjectCard } from '~/components/project-card.tsx'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { SkeletonSwap } from '~/components/interior/skeleton-swap.tsx'
import { TextReveal } from '~/components/interior/text-reveal.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { dashboardStats } from '~/lib/dashboard-stats.ts'
import { projectsQuery, useConfig } from '~/lib/queries.ts'

export const Route = createFileRoute('/dashboard/')({ component: DashboardHome })

function DashboardHome() {
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const projects = data ?? []
  const recent = projects.slice(0, 6)
  const stats = useMemo(() => dashboardStats(projects), [projects])

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <TextReveal
            text="Studio"
            className="block text-4xl font-semibold tracking-tight text-foreground"
          />
          <p className="mt-2 max-w-xl text-sm text-text-secondary">
            Word-level captions, burned into the picture. The tiles below are your last 20 weeks of
            work.
          </p>
        </div>
        <Button asChild className="shadow-lg shadow-brand/25">
          <Link to="/dashboard/new">
            <UploadSimple className="size-4" />
            New upload
          </Link>
        </Button>
      </header>

      <Link
        to="/dashboard/new"
        className="flex items-center justify-between gap-4 rounded-3xl border border-dashed border-white/12 bg-surface-2/70 px-5 py-4 transition-colors hover:border-foreground/30"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-surface-3">
            <UploadSimple className="size-4 text-foreground" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Drop a clip, or browse</span>
            <span className="block text-xs text-text-muted">MP4 or MOV up to 2 GB. Straight to R2.</span>
          </span>
        </span>
        <span className="hidden font-mono text-[11px] tracking-[0.18em] text-text-muted uppercase sm:block">
          Start ingest
        </span>
      </Link>

      {known && !ready && <SetupNotice config={config} />}

      {error && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Could not load projects</CardTitle>
            <CardDescription>{(error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {ready && isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonSwap
              key={i}
              ready={false}
              reserve={140}
              label="Studio metric"
              className="rounded-3xl border border-white/8 p-5"
            >
              {null}
            </SkeletonSwap>
          ))}
        </div>
      )}

      {ready && !isPending && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatKpi label="Projects" value={stats.total} weekly={stats.weekly} />
            <StatKpi label="Ready" value={stats.ready} weekly={stats.weekly} />
            <StatKpi label="In flight" value={stats.inFlight} weekly={stats.weekly} />
            <StatKpi label="Exported" value={stats.exported} weekly={stats.weekly} />
          </div>

          <ActivityHeatmap stats={stats} />

          <div className="grid gap-4 xl:grid-cols-2">
            <UploadWave weekly={stats.weekly} />
            <StatusTreemap rows={stats.statusBars} />
          </div>
        </>
      )}

      {ready && !isPending && !error && recent.length === 0 && (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          body="Upload an MP4 or MOV above. Subit transcribes it with word-level timing and burns captions into the picture."
        />
      )}

      {recent.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-semibold tracking-[0.18em] text-text-muted uppercase">
              Recent projects
            </h2>
            <Link to="/dashboard/projects" className="text-sm font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
