import { create } from 'zustand'
import type { Overlay } from '~/lib/overlays.ts'
import { DEFAULT_THEME, type Theme } from '~/lib/theme.ts'

export type Aspect = 'source' | '9:16' | '1:1' | '16:9'
export type InspectorTab = 'subtitles' | 'styles' | 'font' | 'layout'

type EditorState = {
  theme: Theme
  captionsVisible: boolean
  aspect: Aspect
  inspectorTab: InspectorTab
  selectedCueId: string | null
  /**
   * Overlays live here rather than in the project query for the same reason the
   * theme does: a drag writes them sixty times a second, and a refetch landing
   * mid-drag would snap the image back to the last saved spot.
   */
  overlays: Overlay[]
  selectedOverlayId: string | null
  setTheme: (t: Theme) => void
  patchTheme: (p: Partial<Theme>) => void
  setCaptionsVisible: (v: boolean) => void
  setAspect: (a: Aspect) => void
  setInspectorTab: (tab: InspectorTab) => void
  selectCue: (id: string | null) => void
  setOverlays: (o: Overlay[]) => void
  addOverlay: (o: Overlay) => void
  patchOverlay: (id: string, p: Partial<Overlay>) => void
  removeOverlay: (id: string) => void
  selectOverlay: (id: string | null) => void
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
  inspectorTab: 'styles',
  selectedCueId: null,
  overlays: [],
  selectedOverlayId: null,
  setTheme: (theme) => set({ theme }),
  patchTheme: (p) => set((s) => ({ theme: { ...s.theme, ...p } })),
  setCaptionsVisible: (captionsVisible) => set({ captionsVisible }),
  setAspect: (aspect) => set({ aspect }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  selectCue: (selectedCueId) => set({ selectedCueId }),
  setOverlays: (overlays) => set({ overlays }),
  addOverlay: (o) => set((s) => ({ overlays: [...s.overlays, o], selectedOverlayId: o.id })),
  patchOverlay: (id, p) =>
    set((s) => ({ overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...p } as Overlay) : o)) })),
  removeOverlay: (id) =>
    set((s) => ({
      overlays: s.overlays.filter((o) => o.id !== id),
      selectedOverlayId: s.selectedOverlayId === id ? null : s.selectedOverlayId,
    })),
  selectOverlay: (selectedOverlayId) => set({ selectedOverlayId }),
}))
