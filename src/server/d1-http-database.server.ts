import { d1Query, type D1QueryResult } from '~/server/d1.server.ts'

/**
 * A D1Database-shaped client over the HTTP API. Better Auth detects
 * `prepare` + `batch` + `exec` and uses its D1 Kysely dialect.
 *
 * This app is a Node process (ffmpeg), so there is no Worker `env.DB` binding
 * at request time. Same reason projects already go through d1().
 */
export function createD1HttpDatabase() {
  return {
    prepare(sql: string) {
      let params: unknown[] = []
      const statement = {
        bind(...values: unknown[]) {
          params = values
          return statement
        },
        async all(): Promise<D1QueryResult> {
          return d1Query(sql, params)
        },
      }
      return statement
    },
    async batch(statements: Array<{ all: () => Promise<D1QueryResult> }>) {
      const out: D1QueryResult[] = []
      for (const statement of statements) {
        out.push(await statement.all())
      }
      return out
    },
    async exec(sql: string) {
      await d1Query(sql)
      return { count: 0, duration: 0 }
    },
  }
}
