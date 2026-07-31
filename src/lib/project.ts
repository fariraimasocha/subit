import type { Cue } from './cues.ts'
import type { Theme } from './theme.ts'

/**
 * The project shape lives here rather than in d1.server.ts so client components
 * can import it without tripping the `*.server.ts` import protection.
 */
export type ProjectStatus = 'uploaded' | 'processing' | 'ready' | 'exporting' | 'done' | 'error'

/**
 * Ingest is four slow steps behind one status, and a normalise on a long video
 * can sit there for minutes. Naming the current step is the difference between
 * "it is working" and "it is stuck".
 */
export const INGEST_STAGES = [
  { id: 'normalising', label: 'Normalising the video' },
  { id: 'uploading', label: 'Preparing the preview' },
  { id: 'transcribing', label: 'Transcribing with Whisper' },
  { id: 'grouping', label: 'Grouping into caption cues' },
] as const

export type IngestStage = (typeof INGEST_STAGES)[number]['id']

export type ProjectRow = {
  id: string
  name: string
  status: ProjectStatus
  src_key: string
  norm_key: string | null
  norm_url: string | null
  width: number | null
  height: number | null
  duration: number | null
  cues_json: string | null
  theme_json: string | null
  export_url: string | null
  error: string | null
  created_at: number
  /** Which INGEST_STAGES entry is in flight. Null once the job settles. */
  stage: IngestStage | null
}

/** The row with the two JSON columns parsed. What every route actually wants. */
export type Project = Omit<ProjectRow, 'cues_json' | 'theme_json'> & {
  cues: Cue[]
  theme: Theme | null
}
