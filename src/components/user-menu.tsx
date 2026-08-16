import { CaretDown, SignOut, User } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { authClient } from '~/lib/auth-client.ts'
import { DropdownMenu } from '~/components/ui/dropdown-menu.tsx'

type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
}

export function UserMenu({ user }: { user: SessionUser }) {
  async function handleSignOut() {
    await authClient.signOut()
    toast.success('Signed out')
    window.location.assign('/sign-in')
  }

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger className="inline-flex h-9 max-w-[16rem] items-center gap-1.5 rounded-lg px-2 text-sm text-foreground hover:bg-white/5">
        <span className="truncate">{user.name || user.email}</span>
        <CaretDown className="size-3.5 shrink-0 text-text-secondary" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-52">
        <DropdownMenu.Group>
          <DropdownMenu.Label className="text-xs text-text-muted">{user.email}</DropdownMenu.Label>
          <DropdownMenu.LinkItem href="/dashboard/profile" icon={User}>
            Profile
          </DropdownMenu.LinkItem>
          <DropdownMenu.Item icon={SignOut} onClick={() => void handleSignOut()}>
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}
