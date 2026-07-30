import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download, Loader2, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { StatusBadge } from '~/components/status-badge.tsx'
import { StylePanel } from '~/components/style-panel.tsx'
import { TranscriptPanel } from '~/components/transcript-panel.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs.tsx'
import { VideoPlayer } from '~/components/video-player.tsx'
import type { Cue } from '~/lib/cues.ts'
import { projectQuery, qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { DEFAULT_THEME, type Theme } from '~/lib/theme.ts'
import { getJob, retryIngest, saveCues, saveTheme, startExport } from '~/server/api.ts'
import { useEditor } from '~/store/editor.ts'

export const Route = createFileRoute('/editor/$id')({ component: Editor })

function Editor() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const { config, ready, known } = useConfig()
  const { data: project, isPending, error } = useQuery(projectQuery(id, ready))
  const { theme, setTheme, patchTheme } = useEditor()
  const [currentTime, setCurrentTime] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Hydrate the store from the persisted snapshot once the project arrives.
  useEffect(() => {
    if (project?.theme) setTheme(project.theme)
    else if (project) setTheme(DEFAULT_THEME)
  }, [project?.id, project?.theme, setTheme])

  const persistTheme = useMutation({
    mutationFn: (t: Theme) => saveTheme({ data: { id, theme: t } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(id) }),
  })

  const persistCues = useMutation({
    mutationFn: (cues: Cue[]) => saveCues({ data: { id, cues } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.project(id) })
      toast.success('Transcript saved')
    },
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      await saveTheme({ data: { id, theme } })
      return startExport({ data: { id } })
    },
    onError: (e) => toast.error((e as Error).message),
    onSuccess: ({ jobId }) => setJobId(jobId),
  })

  const retry = useMutation({
    mutationFn: () => retryIngest({ data: { id } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.project(id) })
      toast.success('Retrying')
    },
  })

  // Poll, do not use SSE. TanStack Query makes this one line, and SSE would need
  // a stream controller, an EventSource, a heartbeat and unmount cleanup to
  // shave latency off a progress bar nobody is measuring.
  const job = useQuery({
    queryKey: qk.job(jobId ?? ''),
    queryFn: () => getJob({ data: { jobId: jobId! } }),
    enabled: Boolean(jobId),
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 750 : false),
  })

  useEffect(() => {
    if (job.data?.status === 'done') {
      toast.success('Export ready')
      qc.invalidateQueries({ queryKey: qk.project(id) })
      setJobId(null)
    }
    if (job.data?.status === 'error') {
      toast.error(job.data.error ?? 'Export failed')
      setJobId(null)
    }
  }, [job.data?.status])

  if (known && !ready) return <Shell><SetupNotice config={config} /></Shell>
  if (isPending) return <Skeleton className="m-8 h-[70vh] rounded-xl" />
  if (error) return <Shell><Msg title="Could not load this project" body={(error as Error).message} /></Shell>
  if (!project) return <Shell><Msg title="Project not found" body="It may have been deleted." /></Shell>

  const notReady = project.status === 'uploaded' || project.status === 'processing'
  const exporting = job.data?.status === 'running'

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild size="icon" variant="ghost" aria-label="Back to projects">
            <Link to="/dashboard/projects">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={project.status} />
              {project.width && (
                <span className="text-xs text-muted-foreground">
                  {project.width} x {project.height}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {project.export_url && (
            <Button asChild variant="outline">
              <a href={project.export_url} download>
                <Download className="size-4" />
                Download
              </a>
            </Button>
          )}
          <Button disabled={notReady || exporting || project.cues.length === 0} onClick={() => exportMutation.mutate()}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : null}
            {exporting ? `Exporting ${job.data?.pct ?? 0}%` : 'Export MP4'}
          </Button>
        </div>
      </div>

      {exporting && (
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground transition-[width]" style={{ width: `${job.data?.pct ?? 0}%` }} />
        </div>
      )}

      {project.status === 'error' && (
        <Card className="mb-6 border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Processing failed</CardTitle>
            <CardDescription className="font-mono text-xs break-all">{project.error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
              <RotateCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {notReady && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="size-4 animate-spin" />
              Transcribing
            </CardTitle>
            <CardDescription>
              Normalising the video and running it through Whisper. This page updates itself.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <StylePanel
                theme={theme}
                videoHeight={project.height ?? 1080}
                onChange={(patch) => {
                  patchTheme(patch)
                  persistTheme.mutate({ ...theme, ...patch })
                }}
                onPreset={(t) => {
                  setTheme(t)
                  persistTheme.mutate(t)
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {project.norm_url && project.width && project.height ? (
            <VideoPlayer
              key={project.norm_url}
              src={project.norm_url}
              videoRef={videoRef}
              width={project.width}
              height={project.height}
              cues={project.cues}
              theme={theme}
              onTimeChange={setCurrentTime}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              The preview appears once processing finishes.
            </div>
          )}

          <Tabs defaultValue="transcript">
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript" className="mt-4">
              <TranscriptPanel
                cues={project.cues}
                currentTime={currentTime}
                onChange={(cues) => persistCues.mutate(cues)}
                onSeek={(t) => {
                  if (videoRef.current) videoRef.current.currentTime = t
                }}
              />
            </TabsContent>
            <TabsContent value="details" className="mt-4 space-y-1 text-sm text-muted-foreground">
              <p>Cues: {project.cues.length}</p>
              <p>Duration: {project.duration ? `${project.duration.toFixed(1)}s` : 'unknown'}</p>
              <p>Frame: {project.width && project.height ? `${project.width} x ${project.height}` : 'unknown'}</p>
              <p>Created: {new Date(project.created_at).toLocaleString()}</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
}

function Msg({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/dashboard/projects">Back to projects</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
