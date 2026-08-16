import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clapperboard, Upload } from 'lucide-react'
import { EmptyState } from '~/components/empty-state.tsx'
import { ProjectCard } from '~/components/project-card.tsx'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { SkeletonSwap } from '~/components/interior/skeleton-swap.tsx'
import { TextReveal } from '~/components/interior/text-reveal.tsx'
import { projectsQuery, useConfig } from '~/lib/queries.ts'

export const Route = createFileRoute('/dashboard/')({ component: DashboardHome })

function DashboardHome() {
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const projects = data ?? []
  const recent = projects.slice(0, 6)
  // #region agent log
  if (typeof window !== 'undefined') {
    const w = window as Window & { __subitDashRenders?: number }
    w.__subitDashRenders = (w.__subitDashRenders ?? 0) + 1
    if (w.__subitDashRenders <= 8 || w.__subitDashRenders % 25 === 0) {
      fetch('http://127.0.0.1:7573/ingest/9119238e-d35c-4221-b9d4-77a9e6ffca99', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'aa72d7' },
        body: JSON.stringify({
          sessionId: 'aa72d7',
          runId: 'freeze-2',
          hypothesisId: 'M',
          location: 'dashboard.index.tsx:render',
          message: 'dashboard home render',
          data: {
            n: w.__subitDashRenders,
            ready,
            isPending,
            hasError: Boolean(error),
            projectCount: projects.length,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }
  }
  // #endregion

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <TextReveal
            text="Welcome back"
            className="block text-3xl font-semibold tracking-tight text-foreground"
          />
          <p className="mt-1.5 text-sm text-text-secondary">
            Burn word-by-word captions into your short-form video
          </p>
        </div>
        <Button asChild className="shadow-lg shadow-brand/25">
          <Link to="/dashboard/new">
            <Upload className="size-4" />
            New upload
          </Link>
        </Button>
      </header>

      {/* The design's dropzone card. The real drop handling lives on the new
          project page; this is the doorway to it, styled like the target. */}
      <Link
        to="/dashboard/new"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1 px-6 py-12 text-center transition-colors hover:border-brand/60"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-3">
          <Upload className="size-5 text-brand" />
        </span>
        <span className="text-sm font-semibold">Drop a clip here or click to browse</span>
        <span className="text-xs text-text-muted">
          MP4 or MOV up to 2 GB. Uploads go straight to R2.
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonSwap
              key={i}
              ready={false}
              reserve={256}
              label="Recent project"
              className="rounded-2xl border border-white/10 p-4"
            >
              {null}
            </SkeletonSwap>
          ))}
        </div>
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
            <Link
              to="/dashboard/projects"
              className="text-sm font-medium text-brand hover:underline"
            >
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
