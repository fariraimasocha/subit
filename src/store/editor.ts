import { create } from 'zustand'
import { DEFAULT_THEME, type Theme } from '~/lib/theme.ts'

export type Aspect = 'source' | '9:16' | '1:1' | '16:9'

type EditorState = {
  theme: Theme
  captionsVisible: boolean
  aspect: Aspect
  selectedCueId: string | null
  setTheme: (t: Theme) => void
  patchTheme: (p: Partial<Theme>) => void
  setCaptionsVisible: (v: boolean) => void
  setAspect: (a: Aspect) => void
  selectCue: (id: string | null) => void
}

/**
 * `currentTime` deliberately lives outside this store. Sixty writes a second
 * would rerender the whole editor; the overlay owns it as local state and
 * drives itself off requestAnimationFrame.
 */
export const useEditor = create<EditorState>((set) => ({
  theme: DEFAULT_THEME,
  captionsVisible: true,
  aspect: 'source',
  selectedCueId: null,
  setTheme: (theme) => set({ theme }),
  patchTheme: (p) => set((s) => ({ theme: { ...s.theme, ...p } })),
  setCaptionsVisible: (captionsVisible) => set({ captionsVisible }),
  setAspect: (aspect) => set({ aspect }),
  selectCue: (selectedCueId) => set({ selectedCueId }),
}))
