import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card.tsx'

/**
 * Shown instead of a project list when the credentials are missing. The point
 * is that a fresh clone explains itself rather than showing a failed request.
 */
export function SetupNotice({ config }: { config?: { r2: boolean; d1: boolean; groq: boolean } }) {
  const rows = [
    ['R2', config?.r2, 'R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY, from R2 > Manage API tokens'],
    ['D1', config?.d1, 'CLOUDFLARE_API_TOKEN with D1 Edit, from My Profile > API Tokens'],
    ['Groq', config?.groq, 'GROQ_API_KEY, from console.groq.com'],
  ] as const

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Finish the setup first</CardTitle>
        <CardDescription>
          Subit stores video in R2 and project rows in D1. Add the missing values to .env.local, then
          restart the dev server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([name, ok, hint]) => (
          <div key={name} className="flex items-start gap-3 text-sm">
            <span className={ok ? 'text-emerald-400' : 'text-amber-400'}>{ok ? 'set' : 'todo'}</span>
            <span className="w-12 shrink-0 font-medium">{name}</span>
            <span className="text-muted-foreground">{hint}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
