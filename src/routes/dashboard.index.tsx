import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Upload, Clapperboard } from 'lucide-react'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import { StatusBadge } from '~/components/status-badge.tsx'
import { projectsQuery, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { EmptyState } from '~/components/empty-state.tsx'

export const Route = createFileRoute('/dashboard/')({ component: DashboardHome })

function DashboardHome() {
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const recent = data?.slice(0, 6) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">Your most recent projects.</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/new">
            <Upload className="size-4" />
            New project
          </Link>
        </Button>
      </div>

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {ready && !isPending && !error && recent.length === 0 && (
        <EmptyState
          icon={Clapperboard}
          title="Add your first video"
          body="Drop in an MP4 or MOV. Subit transcribes it with word level timing, cuts it into short cues, and burns them straight into the picture."
          action={
            <Button asChild size="lg">
              <Link to="/dashboard/new">
                <Upload className="size-4" />
                Upload a video
              </Link>
            </Button>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recent.map((p) => (
          <Link key={p.id} to="/editor/$id" params={{ id: p.id }}>
            <Card className="h-full transition-colors hover:border-foreground/30">
              <CardHeader>
                <CardTitle className="truncate text-base">{p.name}</CardTitle>
                <CardDescription>
                  {new Date(p.created_at).toLocaleDateString()}
                  {p.duration ? ` · ${Math.round(p.duration)}s` : ''}
                  {p.cues.length ? ` · ${p.cues.length} cues` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StatusBadge status={p.status} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
