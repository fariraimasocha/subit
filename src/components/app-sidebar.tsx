import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Captions, ChevronRight, FolderOpen, Home, PanelLeftClose, PanelLeftOpen, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button.tsx'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '~/components/ui/sidebar.tsx'
import { projectsQuery, useConfig } from '~/lib/queries.ts'
import { cn } from '~/lib/utils.ts'

const items = [
  { title: 'Home', to: '/dashboard', icon: Home, exact: true },
  { title: 'Projects', to: '/dashboard/projects', icon: FolderOpen, exact: false },
  { title: 'New project', to: '/dashboard/new', icon: Upload, exact: false },
] as const

/** Enough to jump back into what you were editing, not a second projects page. */
const RECENT = 5

/** Injected from package.json by vite.config.ts, so it cannot drift from the release. */
declare const __APP_VERSION__: string

function SidebarCollapseTrigger({ className }: { className?: string }) {
  const { state, toggleSidebar } = useSidebar()
  const expanded = state === 'expanded'
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleSidebar}
      className={cn('size-7 text-muted-foreground hover:text-foreground', className)}
      aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <Icon className="size-4" />
    </Button>
  )
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Same query key the projects table uses, so this is the cached list on the
  // dashboard and one small request on the editor. No poll: creating or deleting
  // a project already invalidates qk.projects.
  const { ready } = useConfig()
  const { data: projects } = useQuery(projectsQuery(ready))
  const recent = projects?.slice(0, RECENT) ?? []
  // ponytail: open by default, remembered for the session only. The sidebar's
  // own collapsed state gets a cookie because it survives a reload; five links
  // do not need one.
  const [recentOpen, setRecentOpen] = useState(true)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Captions className="size-5 shrink-0" />
          <span className="truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Subit
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const link = (
                  <SidebarMenuButton
                    asChild
                    isActive={item.exact ? pathname === item.to : pathname.startsWith(item.to)}
                    // Collapsed to a 3rem rail there is no label, so the tooltip is
                    // the only thing naming the destination.
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )

                // Recent hangs off Projects rather than getting its own group:
                // it is the same list, just the top of it.
                if (item.to !== '/dashboard/projects' || recent.length === 0) {
                  return <SidebarMenuItem key={item.to}>{link}</SidebarMenuItem>
                }

                return (
                  // asChild so the Root does not put a <div> between the <ul> and
                  // its <li>. It also lands data-state on the item, which is what
                  // the chevron rotates off.
                  <Collapsible key={item.to} asChild open={recentOpen} onOpenChange={setRecentOpen}>
                    <SidebarMenuItem>
                      {link}
                      {/* Its own control, because the row itself is a link to the
                          full list and must stay one. */}
                      <CollapsibleTrigger asChild>
                        <SidebarMenuAction aria-label={recentOpen ? 'Hide recent' : 'Show recent'}>
                          <ChevronRight className="transition-transform group-data-[state=open]/menu-item:rotate-90" />
                        </SidebarMenuAction>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {/* SidebarMenuSub hides itself on the collapsed rail,
                            where there is no room for names. */}
                        <SidebarMenuSub>
                          {recent.map((p) => (
                            <SidebarMenuSubItem key={p.id}>
                              <SidebarMenuSubButton
                                asChild
                                size="sm"
                                isActive={pathname === `/editor/${p.id}`}
                              >
                                <Link to="/editor/$id" params={{ id: p.id }} title={p.name}>
                                  <span>{p.name}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-0">
        <div className="flex items-center justify-between px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            v{__APP_VERSION__}
          </span>
          <SidebarCollapseTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
