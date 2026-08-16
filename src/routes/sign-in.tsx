import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Captions, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { authClient } from '~/lib/auth-client.ts'
import { signInSchema, type SignInValues } from '~/lib/auth-schemas.ts'
import { qk } from '~/lib/queries.ts'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'

const searchSchema = z.object({
  email: z.string().optional(),
})

export const Route = createFileRoute('/sign-in')({
  validateSearch: searchSchema,
  component: SignIn,
})

function SignIn() {
  const queryClient = useQueryClient()
  const { email: emailFromSignUp } = Route.useSearch()
  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: emailFromSignUp ?? '', password: '' },
  })

  const signIn = useMutation({
    mutationFn: async (values: SignInValues) => {
      const { data, error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        fetchOptions: { signal: AbortSignal.timeout(20000) },
      })
      if (error?.message) throw new Error(error.message)
      return data
    },
    onError: (error) => {
      toast.error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.session })
      window.location.assign('/dashboard')
    },
  })

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="mx-auto flex size-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Captions className="size-5" />
          </Link>
          <h1 className="mt-5 text-xl font-bold tracking-tight">Sign in to Subit</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Enter your email and password</p>
        </div>

        <div className="rounded-2xl border border-border/35 bg-surface-1 p-6 shadow-lg shadow-black/25">
          <form
            onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
            className="space-y-4"
            aria-busy={signIn.isPending}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="h-11"
                autoComplete="email"
                disabled={signIn.isPending}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-danger">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                className="h-11"
                autoComplete="current-password"
                disabled={signIn.isPending}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="h-11 w-full text-sm" loading={signIn.isPending} disabled={signIn.isPending}>
              {signIn.isPending ? 'Signing in' : 'Sign in'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary">
          Do not have an account?{' '}
          <Link to="/sign-up" className="font-medium text-brand hover:underline">
            Sign up
            <ArrowRight className="ml-0.5 inline size-3.5" />
          </Link>
        </p>
      </div>
    </div>
  )
}
