import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { createD1HttpDatabase } from '~/server/d1-http-database.server.ts'

export const auth = betterAuth({
  appName: 'Subit',
  database: createD1HttpDatabase(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  // Last plugin, as required by Better Auth's TanStack Start docs.
  plugins: [tanstackStartCookies()],
})

export type Session = typeof auth.$Infer.Session
