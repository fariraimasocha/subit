import { Link, useRouterState } from '@tanstack/react-router'
import { Captions, FolderOpen, Home, PanelLeftClose, PanelLeftOpen, Upload } from 'lucide-react'
import { Button } from '~/components/ui/button.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar.tsx'
import { cn } from '~/lib/utils.ts'

const items = [
  { title: 'Home', to: '/dashboard', icon: Home, exact: true },
  { title: 'Projects', to: '/dashboard/projects', icon: FolderOpen, exact: false },
  { title: 'New project', to: '/dashboard/new', icon: Upload, exact: false },
] as const

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
              {items.map((item) => (
                <SidebarMenuItem key={item.to}>
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
                </SidebarMenuItem>
              ))}
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
