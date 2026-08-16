import { useCallback, useEffect, useState } from 'react'
import { AppSidebar } from '~/components/app-sidebar.tsx'
import { SidebarInset, SidebarProvider } from '~/components/ui/sidebar.tsx'

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/)
    if (match) setOpen(match[1] === 'true')
  }, [])

  const onOpenChange = useCallback((next: boolean) => {
    // #region agent log
    fetch('http://127.0.0.1:7573/ingest/9119238e-d35c-4221-b9d4-77a9e6ffca99', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'aa72d7' },
      body: JSON.stringify({
        sessionId: 'aa72d7',
        runId: 'freeze-2',
        hypothesisId: 'M',
        location: 'sidebar-shell.tsx:onOpenChange',
        message: 'sidebar open change',
        data: { next },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    setOpen(next)
    document.cookie = `sidebar_state=${next}; path=/; max-age=${60 * 60 * 24 * 7}`
  }, [])

  return (
    <SidebarProvider
      open={open}
      onOpenChange={onOpenChange}
      collapsible="icon"
      className="subit-sidebar-provider flex min-h-dvh items-stretch"
    >
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
