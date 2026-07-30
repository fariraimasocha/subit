import type { Cue } from './cues.ts'
import type { Theme } from './theme.ts'

/**
 * The project shape lives here rather than in d1.server.ts so client components
 * can import it without tripping the `*.server.ts` import protection.
 */
export type ProjectStatus = 'uploaded' | 'processing' | 'ready' | 'exporting' | 'done' | 'error'

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
}

/** The row with the two JSON columns parsed. What every route actually wants. */
export type Project = Omit<ProjectRow, 'cues_json' | 'theme_json'> & {
  cues: Cue[]
  theme: Theme | null
}
