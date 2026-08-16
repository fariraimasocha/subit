import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { SidebarShell } from '~/components/sidebar-shell.tsx'
import { Separator } from '~/components/ui/separator.tsx'
import { SidebarTrigger } from '~/components/ui/sidebar.tsx'
import { configQuery } from '~/lib/queries.ts'
import { getSession } from '~/lib/auth-fns.ts'
import { readBrowserSession } from '~/lib/session.ts'
import { UserMenu } from '~/components/user-menu.tsx'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session =
      typeof window === 'undefined' ? await getSession() : await readBrowserSession()
    if (!session?.user) {
      throw redirect({ to: '/sign-in' })
    }
    return { user: session.user }
  },
  component: DashboardShell,
})

function DashboardShell() {
  const { user } = Route.useRouteContext()
  const config = useQuery(configQuery())
  const missing = config.data
    ? [!config.data.r2 && 'R2', !config.data.d1 && 'D1', !config.data.groq && 'Groq'].filter(Boolean)
    : []

  return (
    <SidebarShell>
      <>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-sidebar px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
          <span className="text-sm text-muted-foreground">Caption studio</span>
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>
        {missing.length > 0 && (
          <div className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-sm text-warn">
            Not configured yet: {missing.join(', ')}. Add the missing keys to .env.local and restart
            the dev server.
          </div>
        )}
        <div className="flex-1 bg-[radial-gradient(60rem_20rem_at_60%_0%,color-mix(in_oklab,var(--brand)_7%,transparent),transparent)] p-4 md:p-8">
          <Outlet />
        </div>
      </>
    </SidebarShell>
  )
}
