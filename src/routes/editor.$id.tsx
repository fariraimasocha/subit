import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Download, Loader2, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { IngestProgress } from '~/components/ingest-progress.tsx'
import { SidebarShell } from '~/components/sidebar-shell.tsx'
import { StatusBadge } from '~/components/status-badge.tsx'
import { StylePanel } from '~/components/style-panel.tsx'
import { TranscriptPanel } from '~/components/transcript-panel.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import { SidebarTrigger } from '~/components/ui/sidebar.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs.tsx'
import { Timeline } from '~/components/timeline.tsx'
import { VideoPlayer } from '~/components/video-player.tsx'
import type { Cue } from '~/lib/cues.ts'
import { clampOverlay, type Overlay } from '~/lib/overlays.ts'
import { projectQuery, qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { DEFAULT_THEME, type Theme } from '~/lib/theme.ts'
import {
  getDownloadUrl,
  getJob,
  presign,
  retryIngest,
  saveCues,
  saveOverlays,
  saveTheme,
  startExport,
} from '~/server/api.ts'
import { useEditor } from '~/store/editor.ts'

export const Route = createFileRoute('/editor/$id')({ component: Editor })

function Editor() {
  const { id } = Route.useParams()
  const qc = useQueryClient()
  const { config, ready, known } = useConfig()
  const { data: project, isPending, error } = useQuery(projectQuery(id, ready))
  const { theme, setTheme, patchTheme, overlays, setOverlays, addOverlay, removeOverlay } = useEditor()
  const [currentTime, setCurrentTime] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  /**
   * Hydrate the store from the persisted snapshot ONCE per project. project.theme
   * is a fresh object out of JSON.parse on every refetch, so keying the effect on
   * it would re-seed the store each poll and snap a slider back to the last saved
   * value while the user is still dragging it. Overlays have the same problem and
   * get the same treatment.
   */
  const hydrated = useRef<string | null>(null)
  useEffect(() => {
    if (!project || hydrated.current === project.id) return
    hydrated.current = project.id
    setTheme(project.theme ?? DEFAULT_THEME)
    setOverlays(project.overlays)
  }, [project, setTheme, setOverlays])

  /**
   * Every write to this project shares one scope, which is what makes TanStack
   * run them one at a time instead of in parallel. The overlapping sequences are
   * real, not theoretical: drop an image on the timeline and drag another while
   * it uploads, and unscoped mutations could land the drag's snapshot last,
   * silently dropping the image still being uploaded. Export is in the scope for
   * the same reason: runExport reads the row, so a caption drag still in flight
   * would be missing from the burn.
   *
   * ponytail: serialised per tab, not per row. Two tabs on one project still
   * last-write-wins, same ceiling as everything else here.
   */
  const scope = { id: `project-${id}` }

  const persistTheme = useMutation({
    scope,
    mutationFn: (t: Theme) => saveTheme({ data: { id, theme: t } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(id) }),
  })

  const persistCues = useMutation({
    scope,
    mutationFn: (cues: Cue[]) => saveCues({ data: { id, cues } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.project(id) })
      toast.success('Transcript saved')
    },
  })

  // The list is read when the save actually RUNS, never closed over: a commit
  // fires from a pointerup handler that may be several store writes newer than
  // this render, and a queued save may run later still.
  const persistOverlays = useMutation({
    scope,
    mutationFn: () => saveOverlays({ data: { id, overlays: useEditor.getState().overlays } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(id) }),
  })
  const commitOverlays = () => persistOverlays.mutate()

  const addImage = useMutation({
    scope,
    mutationFn: async (file: File) => {
      const contentType = file.type || 'image/png'
      const { key, url, getUrl } = await presign({
        data: { filename: file.name, contentType, size: file.size, kind: 'image' },
      })
      // No XHR progress here: a 10 MB cap makes the upload shorter than the
      // toast that would announce it.
      const put = await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body: file })
      if (!put.ok) throw new Error(`Upload failed with ${put.status}. Check the bucket CORS rules.`)
      // Lands at the playhead, three seconds long, centred and half width.
      const at = videoRef.current?.currentTime ?? 0
      addOverlay(
        clampOverlay(
          {
            id: crypto.randomUUID(),
            key,
            url: getUrl ?? '',
            name: file.name,
            start: at,
            end: at + 3,
            xPct: 50,
            yPct: 50,
            widthPct: 40,
          },
          project?.duration ?? 0,
        ),
      )
      return saveOverlays({ data: { id, overlays: useEditor.getState().overlays } })
    },
    onError: (e) => toast.error((e as Error).message),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(id) }),
  })

  const exportMutation = useMutation({
    // In the scope, so every queued save from the seconds before this click has
    // landed by the time the server reads the row.
    scope,
    mutationFn: async () => {
      await saveTheme({ data: { id, theme } })
      await saveOverlays({ data: { id, overlays: useEditor.getState().overlays } })
      return startExport({ data: { id } })
    },
    onError: (e) => toast.error((e as Error).message),
    onSuccess: ({ jobId }) => setJobId(jobId),
  })

  const download = useMutation({
    mutationFn: () => getDownloadUrl({ data: { id } }),
    onError: (e) => toast.error((e as Error).message),
    // Navigating to a URL whose response says `attachment` downloads it without
    // leaving the editor, which an <a download> cannot do across origins.
    onSuccess: ({ url }) => {
      window.location.href = url
    },
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
    // Same reason as the project poll: the burn runs server side regardless of
    // whether this tab is the focused one.
    refetchIntervalInBackground: true,
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

  // Every early return goes through Shell too, or the sidebar flickers away
  // while the project loads and comes back once it lands.
  if (known && !ready)
    return (
      <Shell>
        <Pad>
          <SetupNotice config={config} />
        </Pad>
      </Shell>
    )
  if (isPending)
    return (
      <Shell>
        <Pad>
          <Skeleton className="h-[70vh] rounded-xl" />
        </Pad>
      </Shell>
    )
  if (error)
    return (
      <Shell>
        <Pad>
          <Msg title="Could not load this project" body={(error as Error).message} />
        </Pad>
      </Shell>
    )
  if (!project)
    return (
      <Shell>
        <Pad>
          <Msg title="Project not found" body="It may have been deleted." />
        </Pad>
      </Shell>
    )

  const notReady = project.status === 'uploaded' || project.status === 'processing'
  const exporting = job.data?.status === 'running'
  // The job map is in memory, so a server restart mid-burn leaves the row stuck
  // on `exporting` with nothing running. Say so instead of showing a badge that
  // implies work is still happening.
  const exportStalled = project.status === 'exporting' && !exporting && !jobId

  return (
    <Shell>
      {/* Editor chrome, not page content: the actions stay reachable while the
          preset list and the transcript scroll underneath. */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger />
        <Button asChild size="icon" variant="ghost" aria-label="Back to projects">
          <Link to="/dashboard/projects">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <h1 className="truncate text-sm font-medium">{project.name}</h1>
        <StatusBadge status={project.status} />
        {project.width && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {project.width} x {project.height}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {project.export_url && (
            <Button size="sm" variant="outline" disabled={download.isPending} onClick={() => download.mutate()}>
              <Download className="size-4" />
              {download.isPending ? 'Preparing' : 'Download'}
            </Button>
          )}
          <Button
            size="sm"
            disabled={
              notReady || exporting || addImage.isPending || (project.cues.length === 0 && overlays.length === 0)
            }
            onClick={() => exportMutation.mutate()}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : null}
            {exporting ? `Exporting ${job.data?.pct ?? 0}%` : 'Export MP4'}
          </Button>
        </div>
      </header>

      {exporting && (
        <div className="h-1 w-full shrink-0 overflow-hidden bg-muted">
          <div className="h-full bg-foreground transition-[width]" style={{ width: `${job.data?.pct ?? 0}%` }} />
        </div>
      )}

      {/* At xl the editor stops being a scrolling page: three columns, each
          scrolling internally, so the preview never leaves the screen while it
          plays. Narrower than that it stays a normal stacked page. */}
      <div className="flex-1 p-4 md:p-6 xl:min-h-0 xl:overflow-hidden">
      {exportStalled && (
        <Card className="mb-6 overflow-hidden border-l-4 border-l-brand">
          <CardHeader>
            <CardTitle className="text-base">That export did not finish</CardTitle>
            <CardDescription>
              The render job is gone, usually because the server restarted while it was working.
              Nothing is lost, press Export MP4 to run it again.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {project.status === 'error' && (
        <Card className="mb-6 overflow-hidden border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="text-base">Processing failed</CardTitle>
            <CardDescription className="font-mono text-xs break-all">{project.error}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <IngestProgress stage={project.stage} failed />
            <Button variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
              <RotateCw className="size-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {notReady && (
        <Card className="mb-6 overflow-hidden border-l-4 border-l-brand">
          <CardHeader>
            <CardTitle className="text-base">Subit is working on your video</CardTitle>
            <CardDescription>This page updates itself, no need to reload.</CardDescription>
          </CardHeader>
          <CardContent>
            <IngestProgress stage={project.stage} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start xl:h-full xl:min-h-0 xl:grid-cols-[340px_minmax(0,1fr)_minmax(300px,360px)] xl:grid-rows-[minmax(0,1fr)] xl:items-stretch">
        {/* Fixed-height so the panel's own footer pins the controls rather than
            the page scrolling them away. */}
        {/* max-h, not h: forcing full height leaves dead space between the last
            toggle and the pinned footer whenever the presets do not fill the
            column. Capping instead lets the panel shrink to its content and
            only pin once the list actually overflows. */}
        <Card className="overflow-hidden p-0 lg:sticky lg:top-20 lg:row-span-2 lg:max-h-[calc(100dvh_-_6.5rem)] xl:static xl:row-span-1 xl:max-h-full xl:min-h-0 xl:self-start">
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
        </Card>

        <div className="space-y-6 xl:min-h-0">
          {project.norm_url && project.width && project.height ? (
            <>
              <VideoPlayer
                key={project.norm_url}
                src={project.norm_url}
                videoRef={videoRef}
                width={project.width}
                height={project.height}
                cues={project.cues}
                theme={theme}
                overlays={overlays}
                onTimeChange={setCurrentTime}
                onPositionCommit={(positionPct) => persistTheme.mutate({ ...theme, positionPct })}
                onOverlayCommit={commitOverlays}
              />
              <Timeline
                videoRef={videoRef}
                cues={project.cues}
                overlays={overlays}
                duration={project.duration ?? 0}
                onCuesChange={(cues) => persistCues.mutate(cues)}
                onOverlayCommit={commitOverlays}
                onAddImage={(file) => addImage.mutate(file)}
                onRemoveOverlay={(oid) => {
                  removeOverlay(oid)
                  commitOverlays()
                }}
                adding={addImage.isPending}
              />
            </>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              The preview appears once processing finishes.
            </div>
          )}

        </div>

        <Tabs
          defaultValue="transcript"
          className="lg:col-start-2 xl:col-start-3 xl:row-start-1 xl:flex xl:min-h-0 xl:flex-col"
        >
            <TabsList>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="transcript" className="mt-4 xl:min-h-0 xl:flex-1">
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

function Pad({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-6">{children}</div>
}

/** The editor sits inside the same nav shell as the dashboard. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell>
      {/*
        h-dvh, not flex-1: a flex item's `flex-basis: 0%` overrides `height`, so
        the viewport boundary has to be a real height here. Without it every
        `h-full` below resolves against an auto-sized row and the columns just
        grow to fit their content, which is how the style panel's pinned footer
        ended up below the fold once there were eighteen presets.
      */}
      <div className="flex min-h-0 flex-1 flex-col xl:h-dvh xl:flex-none xl:overflow-hidden">
        {children}
      </div>
    </SidebarShell>
  )
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
