import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { UploadCloud } from 'lucide-react'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { qk, useConfig } from '~/lib/queries.ts'
import { SetupNotice } from '~/components/setup-notice.tsx'
import { createProjectFn, presign } from '~/server/api.ts'

export const Route = createFileRoute('/dashboard/new')({ component: NewProject })

const ACCEPT = '.mp4,.mov,video/mp4,video/quicktime'
const EXTS = ['mp4', 'mov']

/** The dropzone bypasses the input's `accept`, so it has to check for itself. */
const accepted = (f: File) => EXTS.includes(f.name.split('.').pop()?.toLowerCase() ?? '')
const MAX_BYTES = 2 * 1024 * 1024 * 1024

/** `fetch` has no upload progress event, so the PUT goes through XHR. */
function putWithProgress(url: string, file: File, onPct: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed with ${xhr.status}. Check the bucket CORS rules.`))
    xhr.onerror = () => reject(new Error('Upload blocked by the browser. Check the bucket CORS rules.'))
    xhr.send(file)
  })
}

function NewProject() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [pct, setPct] = useState<number | null>(null)
  const { config, ready, known } = useConfig()

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error('That file is over 2 GB. Trim it first.')
      setPct(0)
      const { key, url } = await presign({
        data: {
          filename: file.name,
          contentType: file.type || 'video/mp4',
          size: file.size,
        },
      })
      await putWithProgress(url, file, setPct)
      // createProjectFn bins the object itself if the row cannot be written.
      return createProjectFn({ data: { name: file.name.replace(/\.[^.]+$/, ''), srcKey: key } })
    },
    onError: (e) => {
      setPct(null)
      toast.error((e as Error).message)
    },
    onSuccess: ({ id }) => {
      setPct(null)
      qc.invalidateQueries({ queryKey: qk.projects })
      toast.success('Uploaded. Transcribing now.')
      navigate({ to: '/editor/$id', params: { id } })
    },
  })

  const busy = upload.isPending
  // Not configured yet is a different state from mid-upload, and the label has
  // to say so rather than claiming to be uploading.
  const disabled = busy || !ready || !config?.r2

  return (
    <div
      className="mx-auto max-w-2xl"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        // Without this guard the flag flickers as the pointer crosses children.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (!file || disabled) return
        if (!accepted(file)) return toast.error('Only MP4 and MOV files are supported')
        upload.mutate(file)
      }}
    >
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New project</h1>
      {known && (!ready || !config?.r2) && (
        <div className="mb-6">
          <SetupNotice config={config} />
        </div>
      )}
      <Card className={dragging ? 'border-foreground/60' : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Upload a video</CardTitle>
          <CardDescription>MP4 or MOV, up to 2 GB. Portrait or landscape both work.</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center transition-colors hover:border-foreground/40 disabled:opacity-60"
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="text-sm">
              {busy ? 'Uploading' : dragging ? 'Drop it here' : 'Drop a file here, or click to pick one'}
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Reset so picking the same file twice fires change again.
              e.target.value = ''
              if (file) upload.mutate(file)
            }}
          />

          {pct !== null && (
            <div className="mt-6">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-foreground transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {pct < 100 ? `Uploading ${pct}%` : 'Uploaded, creating the project'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        Long videos are sliced into 10 minute chunks for transcription, so length is not a hard limit.
      </p>

      {upload.isError && (
        <Button className="mt-4" variant="outline" onClick={() => upload.reset()}>
          Try again
        </Button>
      )}
    </div>
  )
}
