import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { authClient } from '~/lib/auth-client.ts'
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateNameSchema,
  type ChangePasswordValues,
  type DeleteAccountValues,
  type UpdateNameValues,
} from '~/lib/auth-schemas.ts'
import { Button } from '~/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'

export const Route = createFileRoute('/dashboard/profile')({ component: Profile })

const dashboardRoute = getRouteApi('/dashboard')

function Profile() {
  const { user } = dashboardRoute.useRouteContext()

  const nameForm = useForm<UpdateNameValues>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: { name: user.name },
  })
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const deleteForm = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  })

  const updateName = useMutation({
    mutationFn: async (values: UpdateNameValues) => {
      const { error } = await authClient.updateUser({ name: values.name })
      if (error?.message) throw new Error(error.message)
    },
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success('Name updated')
      window.location.reload()
    },
  })

  const changePassword = useMutation({
    mutationFn: async (values: ChangePasswordValues) => {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
      if (error?.message) throw new Error(error.message)
    },
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      passwordForm.reset()
      toast.success('Password updated')
    },
  })

  const deleteAccount = useMutation({
    mutationFn: async (values: DeleteAccountValues) => {
      const { error } = await authClient.deleteUser({ password: values.password })
      if (error?.message) throw new Error(error.message)
    },
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success('Account deleted')
      window.location.assign('/')
    },
  })

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1.5 text-sm text-text-secondary">{user.email}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Name</CardTitle>
          <CardDescription>This is what we show in the header menu.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={nameForm.handleSubmit((values) => updateName.mutate(values))}
            className="space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" className="h-11" autoComplete="name" {...nameForm.register('name')} />
              {nameForm.formState.errors.name && (
                <p className="text-sm text-danger">{nameForm.formState.errors.name.message}</p>
              )}
            </div>
            <Button type="submit" loading={updateName.isPending} disabled={updateName.isPending}>
              {updateName.isPending ? 'Saving' : 'Save name'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Use a new password of at least 8 characters. Other sessions will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}
            className="space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                className="h-11"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-danger">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                className="h-11"
                autoComplete="new-password"
                {...passwordForm.register('newPassword')}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-danger">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                className="h-11"
                autoComplete="new-password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-danger">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" loading={changePassword.isPending} disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Updating' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-danger/40" id="delete-account">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>This permanently removes your account. You will need to sign up again to use Subit.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={deleteForm.handleSubmit((values) => deleteAccount.mutate(values))}
            className="space-y-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                className="h-11"
                autoComplete="current-password"
                {...deleteForm.register('password')}
              />
              {deleteForm.formState.errors.password && (
                <p className="text-sm text-danger">{deleteForm.formState.errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              variant="destructive"
              loading={deleteAccount.isPending}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? 'Deleting' : 'Delete account'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
