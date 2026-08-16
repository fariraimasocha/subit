import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { EditorInspector } from '~/components/editor-inspector.tsx'
import { IngestProgress } from '~/components/ingest-progress.tsx'
import { ProgressBar } from '~/components/interior/progress-bar.tsx'
import { StatusBadge } from '~/components/status-badge.tsx'
import { OverlayFontPanel } from '~/components/overlay-font-panel.tsx'
import { StylePanel } from '~/components/style-panel.tsx'
import { TranscriptPanel } from '~/components/transcript-panel.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Skeleton } from '~/components/ui/skeleton.tsx'
import { Timeline } from '~/components/timeline.tsx'
import { VideoPlayer } from '~/components/video-player.tsx'
import type { Cue } from '~/lib/cues.ts'
import { clampOverlay, isTextOverlay, type Overlay } from '~/lib/overlays.ts'
import { projectQuery, qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { DEFAULT_THEME, themePaintKey, type Theme } from '~/lib/theme.ts'
import {
  getDownloadUrl,
  getJob,
  presign,
  renameProjectFn,
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
  const {
    theme,
    setTheme,
    patchTheme,
    overlays,
    setOverlays,
    addOverlay,
    patchOverlay,
    removeOverlay,
    selectCue,
    selectedOverlayId,
    setInspectorTab,
  } = useEditor()
  const [currentTime, setCurrentTime] = useState(0)
  const [jobId, setJobId] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  /** Theme snapshot from the last successful export in this session. */
  const exportedThemeKey = useRef<string | null>(null)
  const [exportReady, setExportReady] = useState(false)

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

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7504/ingest/c7aaf77f-b085-4d39-8f3f-23b6f4595e57', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd106a0' },
      body: JSON.stringify({
        sessionId: 'd106a0',
        location: 'editor.$id.tsx:mount',
        message: 'editor loaded',
        data: { projectId: id, runId: 'post-fix-7' },
        timestamp: Date.now(),
        hypothesisId: 'I',
      }),
    }).catch(() => {})
    // #endregion
  }, [id])

  /**
   * exportedThemeKey is only set after a successful export in this session. Never
   * infer it from project.theme: saving Kendrick to the DB must not mark an old
   * MP4 as fresh.
   *
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
            kind: 'image',
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

  const addText = () => {
    const at = videoRef.current?.currentTime ?? 0
    const t = useEditor.getState().theme
    const overlayId = crypto.randomUUID()
    addOverlay(
      clampOverlay(
        {
          id: overlayId,
          kind: 'text',
          text: 'Text',
          name: 'Text',
          fontFamily: t.fontFamily,
          fontFile: t.fontFile,
          color: '#FFFFFF',
          fontSizePct: 6,
          start: at,
          end: at + 3,
          xPct: 50,
          yPct: 28,
          widthPct: 70,
        },
        project?.duration ?? 0,
      ),
    )
    setInspectorTab('font')
    commitOverlays()
  }

  const exportMutation = useMutation({
    // In the scope, so every queued save from the seconds before this click has
    // landed by the time the server reads the row.
    scope,
    mutationFn: async () => {
      const storeTheme = useEditor.getState().theme
      // #region agent log
      fetch('http://127.0.0.1:7504/ingest/c7aaf77f-b085-4d39-8f3f-23b6f4595e57',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d106a0'},body:JSON.stringify({sessionId:'d106a0',location:'editor.$id.tsx:exportMutation',message:'export save theme',data:{savedId:storeTheme.id,boxColor:storeTheme.boxColor,runId:'post-fix-7'},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await saveTheme({ data: { id, theme: storeTheme } })
      await saveOverlays({ data: { id, overlays: useEditor.getState().overlays } })
      return startExport({ data: { id, theme: storeTheme } })
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
      toast.success('Export ready. Download your new MP4 below.')
      exportedThemeKey.current = themePaintKey(useEditor.getState().theme)
      setExportReady(true)
      // #region agent log
      fetch('http://127.0.0.1:7504/ingest/c7aaf77f-b085-4d39-8f3f-23b6f4595e57', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd106a0' },
        body: JSON.stringify({
          sessionId: 'd106a0',
          location: 'editor.$id.tsx:exportDone',
          message: 'export job done',
          data: {
            themeId: useEditor.getState().theme.id,
            boxColor: useEditor.getState().theme.boxColor,
            runId: 'post-fix-7',
          },
          timestamp: Date.now(),
          hypothesisId: 'A',
        }),
      }).catch(() => {})
      // #endregion
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

  const styleProps = {
    theme,
    videoHeight: project.height ?? 1080,
    onChange: (patch: Partial<Theme>) => {
      patchTheme(patch)
      exportedThemeKey.current = null
      setExportReady(false)
      const storeTheme = useEditor.getState().theme
      const merged = { ...storeTheme, ...patch }
      persistTheme.mutate(merged)
    },
    onPreset: (t: Theme) => {
      const next = { ...t }
      setTheme(next)
      exportedThemeKey.current = null
      setExportReady(false)
      const cue =
        project.cues.find((c) => c.id === useEditor.getState().selectedCueId) ?? project.cues[0]
      if (cue) {
        selectCue(cue.id)
        if (videoRef.current) {
          videoRef.current.pause()
          videoRef.current.currentTime = cue.start
        }
      }
      persistTheme.mutate(next)
    },
  }

  const selected = overlays.find((o) => o.id === selectedOverlayId)
  const selectedText = selected && isTextOverlay(selected) ? selected : null

  return (
    <Shell>
      {/* Editor chrome, not page content: the actions stay reachable while the
          preset list and the transcript scroll underneath. */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-sidebar px-4">
        <Button asChild size="icon" variant="ghost" aria-label="Back to projects">
          <Link to="/dashboard/projects">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <ProjectTitle id={project.id} name={project.name} />
        <StatusBadge status={project.status} />
        {project.width && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {project.width} x {project.height}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {project.export_url && exportReady && (
            <Button
              size="sm"
              variant="outline"
              disabled={download.isPending}
              onClick={() => download.mutate()}
            >
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
            Export MP4
          </Button>
        </div>
      </header>

      {exporting && (
        <div className="shrink-0 border-b border-white/10 bg-surface-2 px-5 py-3">
          <ProgressBar
            value={job.data?.pct ?? 0}
            label={
              (job.data?.pct ?? 0) < 100 ? 'Exporting MP4' : 'Finishing the file'
            }
            pendingLabel="Starting"
            completeLabel="Export complete"
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row xl:overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-video-surface">
          {exportStalled && (
            <Card className="mx-4 mt-4 gap-0 overflow-hidden rounded-xl border-white/10 bg-surface-2 py-5 shadow-none">
              <CardHeader className="px-5">
                <CardTitle className="text-[15px] font-semibold tracking-tight">That export did not finish</CardTitle>
                <CardDescription>
                  The render job is gone, usually because the server restarted while it was working.
                  Nothing is lost. Press Export MP4 to run it again.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {project.status === 'error' && (
            <IngestProgress
              className="mx-4 mt-4"
              stage={project.stage}
              failed
              error={project.error}
              retrying={retry.isPending}
              onRetry={() => retry.mutate()}
            />
          )}

          {notReady && <IngestProgress className="mx-4 mt-4" stage={project.stage} />}

          {project.norm_url && project.width && project.height ? (
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
              onPositionCommit={(positionPct) => {
                const t = useEditor.getState().theme
                persistTheme.mutate({ ...t, positionPct })
              }}
              onOverlayCommit={commitOverlays}
            >
              <div className="shrink-0 border-t border-white/10 px-3 py-2">
                <Timeline
                  videoRef={videoRef}
                  cues={project.cues}
                  overlays={overlays}
                  duration={project.duration ?? 0}
                  onCuesChange={(cues) => persistCues.mutate(cues)}
                  onOverlayCommit={commitOverlays}
                  onAddImage={(file) => addImage.mutate(file)}
                  onAddText={addText}
                  onRemoveOverlay={(oid) => {
                    removeOverlay(oid)
                    commitOverlays()
                  }}
                  adding={addImage.isPending}
                />
              </div>
            </VideoPlayer>
          ) : (
            <div className="m-4 flex aspect-video items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              The preview appears once processing finishes.
            </div>
          )}
        </div>

        <EditorInspector
          subtitles={
            <>
              <header className="flex h-12 shrink-0 items-center justify-between px-4">
                <h2 className="text-xs font-semibold tracking-[0.16em] text-text-muted">SUBTITLES</h2>
                <span className="font-mono text-xs text-text-muted">{project.cues.length} cues</span>
              </header>
              <div className="min-h-0 flex-1 px-3 pb-3">
                <TranscriptPanel
                  cues={project.cues}
                  currentTime={currentTime}
                  onChange={(cues) => persistCues.mutate(cues)}
                  onSeek={(t) => {
                    if (videoRef.current) videoRef.current.currentTime = t
                  }}
                  onSelectCue={(cue) => {
                    selectCue(cue.id)
                    if (videoRef.current) videoRef.current.currentTime = cue.start
                  }}
                />
              </div>
            </>
          }
          styles={<StylePanel {...styleProps} pane="presets" />}
          font={
            selectedText ? (
              <OverlayFontPanel
                overlay={selectedText}
                videoHeight={project.height ?? 1080}
                onChange={(patch) => {
                  patchOverlay(selectedText.id, patch)
                  commitOverlays()
                }}
                pane="font"
              />
            ) : (
              <StylePanel {...styleProps} pane="font" />
            )
          }
          layout={
            selectedText ? (
              <OverlayFontPanel
                overlay={selectedText}
                videoHeight={project.height ?? 1080}
                onChange={(patch) => {
                  patchOverlay(selectedText.id, patch)
                  commitOverlays()
                }}
                pane="layout"
              />
            ) : (
              <StylePanel {...styleProps} pane="layout" />
            )
          }
        />
      </div>
    </Shell>
  )
}

const renameSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name').max(200, 'Use 200 characters or fewer'),
})

function ProjectTitle({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const form = useForm<z.infer<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name },
  })

  useEffect(() => form.reset({ name }), [form, name])

  const rename = useMutation({
    mutationFn: (values: z.infer<typeof renameSchema>) => renameProjectFn({ data: { id, name: values.name } }),
    onError: (e) => toast.error((e as Error).message),
    onSuccess: ({ name: next }) => {
      qc.invalidateQueries({ queryKey: qk.project(id) })
      qc.invalidateQueries({ queryKey: qk.projects })
      toast.success(`Renamed to ${next}`)
      setEditing(false)
    },
  })

  if (!editing) {
    return (
      <button
        type="button"
        className="min-w-0 truncate text-left text-sm font-medium hover:text-brand"
        title="Rename project"
        onClick={() => {
          form.reset({ name })
          setEditing(true)
        }}
      >
        {name}
      </button>
    )
  }

  return (
    <form
      className="min-w-0 max-w-64 flex-1"
      onSubmit={form.handleSubmit((values) => {
        if (values.name === name) {
          setEditing(false)
          return
        }
        rename.mutate(values)
      })}
    >
      <Input
        aria-label="Project name"
        autoFocus
        className="h-8"
        disabled={rename.isPending}
        {...form.register('name')}
        onBlur={() => form.handleSubmit((values) => {
          if (values.name === name) {
            setEditing(false)
            return
          }
          rename.mutate(values)
        })()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            form.reset({ name })
            setEditing(false)
          }
        }}
      />
    </form>
  )
}

function Pad({ children }: { children: React.ReactNode }) {
  return <div className="p-4 md:p-6">{children}</div>
}

/** The editor sits inside the same nav shell as the dashboard. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] flex-col bg-background xl:h-dvh xl:min-h-0 xl:overflow-hidden">{children}</div>
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
