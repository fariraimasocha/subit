import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '~/lib/auth.ts'
import { agentLogAuth } from '~/server/debug-log.server.ts'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const started = Date.now()
  // #region agent log
  agentLogAuth({
    runId: 'freeze-2',
    hypothesisId: 'L',
    location: 'auth.server.ts:getSession',
    message: 'server getSession start',
  })
  // #endregion
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  // #region agent log
  agentLogAuth({
    runId: 'freeze-2',
    hypothesisId: 'L',
    location: 'auth.server.ts:getSession',
    message: 'server getSession end',
    data: { hasSession: Boolean(session), ms: Date.now() - started },
  })
  // #endregion
  return session
})

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
})
