import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Captions, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { authClient } from '~/lib/auth-client.ts'
import { signUpSchema, type SignUpValues } from '~/lib/auth-schemas.ts'
import { qk } from '~/lib/queries.ts'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'

export const Route = createFileRoute('/sign-up')({ component: SignUp })

function SignUp() {
  const queryClient = useQueryClient()
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const signUp = useMutation({
    mutationFn: async (values: SignUpValues) => {
      const { data, error } = await authClient.signUp.email({
        name: values.name,
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
      toast.success('Account created')
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
          <h1 className="mt-5 text-xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1.5 text-sm text-text-secondary">Start captioning in seconds</p>
        </div>

        <div className="rounded-2xl border border-border/35 bg-surface-1 p-6 shadow-lg shadow-black/25">
          <form
            onSubmit={form.handleSubmit((values) => signUp.mutate(values))}
            className="space-y-4"
            aria-busy={signUp.isPending}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your name"
                className="h-11"
                autoComplete="name"
                disabled={signUp.isPending}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-danger">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="h-11"
                autoComplete="email"
                disabled={signUp.isPending}
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
                placeholder="At least 8 characters"
                className="h-11"
                autoComplete="new-password"
                disabled={signUp.isPending}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-danger">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="h-11 w-full text-sm" loading={signUp.isPending} disabled={signUp.isPending}>
              {signUp.isPending ? 'Creating account' : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link
            to="/sign-in"
            search={{ email: form.watch('email') || undefined }}
            className="font-medium text-brand hover:underline"
          >
            Sign in
            <ArrowRight className="ml-0.5 inline size-3.5" />
          </Link>
        </p>
      </div>
    </div>
  )
}
