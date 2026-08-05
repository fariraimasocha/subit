import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { UploadCloud } from 'lucide-react'
import { Button } from '~/components/ui/button.tsx'
import { cn } from '~/lib/utils.ts'
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
      <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
      <p className="mt-1.5 text-sm text-text-secondary">
        Your clip is uploaded straight to R2, then Whisper transcribes it word by word.
      </p>

      {known && (!ready || !config?.r2) && (
        <div className="mt-6">
          <SetupNotice config={config} />
        </div>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'mt-6 flex w-full flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface-1 px-6 py-16 text-center transition-colors hover:border-brand/60 disabled:opacity-60',
          dragging && 'border-brand',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-3">
          <UploadCloud className="size-5 text-brand" />
        </span>
        <span className="text-sm font-semibold">
          {busy ? 'Uploading' : dragging ? 'Drop it here' : 'Drop a clip here or click to browse'}
        </span>
        <span className="text-xs text-text-muted">
          MP4 or MOV, up to 2 GB. iPhone rotation handled automatically.
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
          if (!file) return
          // `accept` is only a hint: the picker still allows "All files".
          if (!accepted(file)) return toast.error('Only MP4 and MOV files are supported')
          upload.mutate(file)
        }}
      />

      {pct !== null && (
        <div className="mt-6 rounded-2xl border border-border/40 bg-surface-2 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {pct < 100 ? 'Uploading to R2' : 'Uploaded, creating the project'}
            </span>
            <span className="font-mono text-sm font-bold text-brand tabular-nums">{pct}%</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted">
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
