import { AlignCenterVertical, Palette, Subtitles, TextAa } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cn } from '~/lib/utils.ts'
import { useEditor, type InspectorTab } from '~/store/editor.ts'

const TABS: { id: InspectorTab; label: string; Icon: typeof Subtitles }[] = [
  { id: 'subtitles', label: 'Subtitles', Icon: Subtitles },
  { id: 'styles', label: 'Styles', Icon: Palette },
  { id: 'font', label: 'Font', Icon: TextAa },
  { id: 'layout', label: 'Layout', Icon: AlignCenterVertical },
]

type Props = {
  subtitles: ReactNode
  styles: ReactNode
  font: ReactNode
  layout: ReactNode
}

/**
 * Right-hand inspector from the AutoSubtitles workspace: one contextual pane
 * plus a narrow tool rail. The video keeps the left two-thirds.
 */
export function EditorInspector({ subtitles, styles, font, layout }: Props) {
  const tab = useEditor((s) => s.inspectorTab)
  const setTab = useEditor((s) => s.setInspectorTab)
  const panes = { subtitles, styles, font, layout }

  return (
    <aside className="flex min-h-0 flex-col-reverse border-t border-white/10 bg-sidebar xl:h-full xl:w-[392px] xl:shrink-0 xl:flex-row xl:border-t-0 xl:border-l">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{panes[tab]}</div>
      <nav
        className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-white/10 px-1 py-1 xl:w-[72px] xl:flex-col xl:overflow-x-visible xl:border-b-0 xl:border-l xl:px-1.5 xl:py-2"
        aria-label="Editor tools"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={active}
              className={cn(
                'flex min-w-16 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] leading-none transition-colors xl:min-w-0 xl:flex-none',
                active
                  ? 'bg-surface-3 text-foreground'
                  : 'text-text-muted hover:bg-surface-2 hover:text-foreground',
              )}
            >
              <Icon className="size-5" weight={active ? 'fill' : 'regular'} />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
