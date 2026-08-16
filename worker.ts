import { Container } from '@cloudflare/containers'

/**
 * A dumb front door. Everything the app does happens inside the container,
 * because ffmpeg needs a subprocess and a filesystem and the export jobs need
 * a process that stays alive after the response is sent. See jobs.server.ts.
 */
type Env = {
  SUBIT: DurableObjectNamespace<Subit>
  CLOUDFLARE_S3_API: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_API_TOKEN: string
  D1_DATABASE_ID: string
  R2_BUCKET: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_PUBLIC_URL?: string
  GROQ_API_KEY: string
  EXPORT_ENCODER?: string
  GITHUB_REPO?: string
  GITHUB_TOKEN?: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}

/** Secrets and vars are set on the Worker, so hand them down as process.env. */
const CONTAINER_ENV = [
  'CLOUDFLARE_S3_API',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'D1_DATABASE_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PUBLIC_URL',
  'GROQ_API_KEY',
  'EXPORT_ENCODER',
  'GITHUB_REPO',
  'GITHUB_TOKEN',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
] as const

export class Subit extends Container<Env> {
  defaultPort = 3000
  /**
   * An export of a long video can outlive the request that started it, and a
   * sleeping instance takes its in-memory jobs Map with it. 30m is generous
   * enough that only an abandoned tab pays for it; the UI already handles the
   * loss as "Job lost, retry".
   */
  sleepAfter = '30m'
  // Unset optionals are dropped, or an absent R2_PUBLIC_URL arrives as the
  // string "undefined" and publicUrl() stops falling back to a presigned GET.
  envVars = Object.fromEntries(
    CONTAINER_ENV.map((k) => [k, this.env[k]]).filter(([, v]) => v !== undefined),
  ) as Record<string, string>
}

export default {
  // One named instance, on purpose. The jobs Map and the issuedKeys Map are
  // per-process, so a second container would answer poll requests for jobs it
  // has never heard of. Matched by max_instances: 1 in wrangler.jsonc.
  fetch(request: Request, env: Env) {
    return env.SUBIT.getByName('main').fetch(request)
  },
}
