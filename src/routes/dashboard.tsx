import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SidebarShell } from '~/components/sidebar-shell.tsx'
import { Separator } from '~/components/ui/separator.tsx'
import { SidebarTrigger } from '~/components/ui/sidebar.tsx'
import { configQuery } from '~/lib/queries.ts'

export const Route = createFileRoute('/dashboard')({ component: DashboardShell })

function DashboardShell() {
  const config = useQuery(configQuery())
  const missing = config.data
    ? [!config.data.r2 && 'R2', !config.data.d1 && 'D1', !config.data.groq && 'Groq'].filter(Boolean)
    : []

  return (
    <SidebarShell>
      <>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm text-muted-foreground">Caption studio</span>
        </header>
        {missing.length > 0 && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            Not configured yet: {missing.join(', ')}. Add the missing keys to .env.local and restart
            the dev server.
          </div>
        )}
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </>
    </SidebarShell>
  )
}
