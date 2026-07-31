import { useEffect, useState } from 'react'
import { AppSidebar } from '~/components/app-sidebar.tsx'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar.tsx'

/**
 * The nav shell, shared by the dashboard and the editor so the sidebar does not
 * vanish when you open a project.
 *
 * SidebarProvider writes `sidebar_state` on every toggle but only reads it via
 * `defaultOpen`, which the server cannot know. Controlling `open` here and
 * applying the cookie after mount keeps SSR and the first client render
 * identical, so collapsing on one route survives navigating to the other
 * without a hydration mismatch.
 */
export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
    if (match) setOpen(match[1] === 'true')
  }, [])

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
