import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Clapperboard, FolderOpen, Upload, Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '~/components/empty-state.tsx'
import { ProjectCard } from '~/components/project-card.tsx'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import { TextAnimate } from '~/components/ui/text-animate.tsx'
import type { Project } from '~/lib/project.ts'
import { projectsQuery, useConfig } from '~/lib/queries.ts'

export const Route = createFileRoute('/dashboard/')({ component: DashboardHome })

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function DashboardHome() {
  const { config, ready, known } = useConfig()
  const { data, isPending, error } = useQuery(projectsQuery(ready))
  const projects = data ?? []
  const recent = projects.slice(0, 6)

  // The hour is the browser's, not the server's, so it can only be read after
  // mount. Rendering it during SSR would hydrate into a different greeting for
  // anyone in another timezone.
  const [hello, setHello] = useState<string | null>(null)
  useEffect(() => setHello(greeting()), [])

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        {/* Fixed height so the row does not jump when the greeting lands. */}
        <div className="flex h-10 items-center">
          {hello && (
            <TextAnimate
              text={hello}
              type="calmInUp"
              className="text-3xl font-semibold tracking-tight"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/dashboard/projects">
              <FolderOpen className="size-4" />
              All projects
            </Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard/new">
              <Upload className="size-4" />
              New project
            </Link>
          </Button>
        </div>
      </header>

      <QuickActions latest={projects[0]} />

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
            <Skeleton key={i} className="h-64 rounded-[28px]" />
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

      {recent.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recent projects</h2>
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

/**
 * Three real entry points, not feature adverts: upload, browse, and pick up
 * where you left off. The third only appears once there is something to
 * continue.
 */
function QuickActions({ latest }: { latest?: Project }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Action
        to="/dashboard/new"
        icon={Upload}
        title="Add captions"
        body="Upload an MP4 or MOV and Subit transcribes it word by word."
      />
      <Action
        to="/dashboard/projects"
        icon={FolderOpen}
        title="Browse projects"
        body="Every clip you have uploaded, with status and export."
      />
      {latest && (
        <Action
          to="/editor/$id"
          params={{ id: latest.id }}
          icon={Wand2}
          title="Keep editing"
          body={latest.name}
        />
      )}
    </div>
  )
}

function Action({
  to,
  params,
  icon: Icon,
  title,
  body,
}: {
  to: string
  params?: Record<string, string>
  icon: React.ElementType
  title: string
  body: string
}) {
  return (
    <Link
      to={to}
      params={params as never}
      className="group flex items-start gap-4 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors group-hover:bg-foreground group-hover:text-background">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{body}</span>
      </span>
    </Link>
  )
}
