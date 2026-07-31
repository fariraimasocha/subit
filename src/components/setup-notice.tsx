import { CheckCircle2, Circle } from 'lucide-react'
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
    // A left accent stripe marks this as a callout rather than another panel,
    // and costs one border instead of a whole decorated container.
    <Card className="overflow-hidden border-l-4 border-l-amber-500">
      <CardHeader>
        <CardTitle className="text-base">Finish the setup first</CardTitle>
        <CardDescription>
          Subit stores video in R2 and project rows in D1. Add the missing values to .env.local, then
          restart the dev server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Icons rather than the words "set" and "todo": the state is scannable
            down the column without reading it. */}
        {rows.map(([name, ok, hint]) => (
          <div key={name} className="flex items-start gap-3 text-sm">
            {ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            )}
            <span className="w-12 shrink-0 font-medium">{name}</span>
            <span className="text-muted-foreground">{hint}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
