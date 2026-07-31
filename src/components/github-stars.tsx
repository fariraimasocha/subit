import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { Button } from '~/components/ui/button.tsx'
import { getStars } from '~/server/api.ts'

/**
 * lucide dropped its brand icons, so the mark is inline. It is one path and it
 * has to be the real GitHub logo to be recognised at 16px.
 */
function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden focusable="false" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}

/**
 * The count is optional on purpose: GitHub can rate-limit or the repo can be
 * private, and a link with no number beside it is fine. Never render a zero or
 * a spinner in its place.
 */
export function GitHubStars() {
  const { data } = useQuery({
    queryKey: ['github-stars'],
    queryFn: () => getStars(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })

  const repo = data?.repo ?? 'fariraimasocha/subit'

  return (
    <Button asChild size="sm" variant="outline" className="gap-2">
      <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer noopener">
        <GithubMark className="size-4" />
        <span>GitHub</span>
        {typeof data?.count === 'number' && (
          <span className="flex items-center gap-1 border-l pl-2 text-xs tabular-nums text-muted-foreground">
            <Star className="size-3 fill-current" />
            {data.count.toLocaleString()}
          </span>
        )}
      </a>
    </Button>
  )
}
