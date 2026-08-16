import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { FolderOpen, House, SidebarSimple, Subtitles, Upload } from '@phosphor-icons/react'
import {
  Sidebar,
  SidebarCollapsible,
  SidebarCollapsibleContent,
  SidebarCollapsibleTrigger,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuChevron,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar,
} from '~/components/ui/sidebar.tsx'
import { projectsQuery, useConfig } from '~/lib/queries.ts'
import { cn } from '~/lib/utils.ts'

const items = [
  { title: 'Home', href: '/dashboard', icon: House, exact: true },
  { title: 'Projects', href: '/dashboard/projects', icon: FolderOpen, exact: false },
  { title: 'New project', href: '/dashboard/new', icon: Upload, exact: false },
] as const

const RECENT = 5

declare const __APP_VERSION__: string

function SidebarCollapseTrigger({ className }: { className?: string }) {
  const { state } = useSidebar()
  const expanded = state === 'expanded' || state === 'peeking'

  return (
    <SidebarTrigger
      className={cn('text-muted-foreground hover:text-foreground', className)}
      aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <SidebarSimple className="size-4" />
    </SidebarTrigger>
  )
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { ready } = useConfig()
  const { data: projects } = useQuery(projectsQuery(ready))
  const recent = projects?.slice(0, RECENT) ?? []

  return (
    <Sidebar className="border-white/10">
      <SidebarHeader className="group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0">
        <Link
          to="/"
          className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-3 no-underline group-data-[state=collapsed]/sidebar:justify-center group-data-[state=collapsed]/sidebar:px-0"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Subtitles className="size-4" weight="fill" />
          </span>
          <span className="truncate font-mono text-base font-bold tracking-tight group-data-[state=collapsed]/sidebar:hidden">
            subit
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)

              if (item.href !== '/dashboard/projects' || recent.length === 0) {
                return (
                  <SidebarMenuButton
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    active={active}
                    tooltip={item.title}
                  >
                    {item.title}
                  </SidebarMenuButton>
                )
              }

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarCollapsible defaultOpen>
                    <SidebarCollapsibleTrigger
                      render={
                        <SidebarMenuButton href={item.href} icon={item.icon} active={active} tooltip={item.title}>
                          {item.title}
                          <SidebarMenuChevron />
                        </SidebarMenuButton>
                      }
                    />
                    <SidebarCollapsibleContent>
                      <SidebarMenuSub>
                        {recent.map((p) => (
                          <SidebarMenuSubButton
                            key={p.id}
                            href={`/editor/${p.id}`}
                            active={pathname === `/editor/${p.id}`}
                            title={p.name}
                          >
                            {p.name}
                          </SidebarMenuSubButton>
                        ))}
                      </SidebarMenuSub>
                    </SidebarCollapsibleContent>
                  </SidebarCollapsible>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-white/10">
        <div className="flex w-full items-center justify-between group-data-[state=collapsed]/sidebar:justify-center">
          <span className="text-xs text-muted-foreground group-data-[state=collapsed]/sidebar:hidden">
            v{__APP_VERSION__}
          </span>
          <SidebarCollapseTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
