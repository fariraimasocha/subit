/** Browser path: Better Auth HTTP session, not a TanStack server-fn RPC. */
export async function readBrowserSession() {
  const res = await fetch('/api/auth/get-session', { credentials: 'include' })
  if (!res.ok) return null
  const body = (await res.json()) as {
    user?: { id: string; name: string; email: string; image?: string | null }
  } | null
  if (!body?.user) return null
  return body
}
