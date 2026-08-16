import { createServerFn } from '@tanstack/react-start'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const { auth } = await import('~/lib/auth.ts')
  const headers = getRequestHeaders()
  return auth.api.getSession({ headers })
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequestHeaders } = await import('@tanstack/react-start/server')
  const { auth } = await import('~/lib/auth.ts')
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
})
