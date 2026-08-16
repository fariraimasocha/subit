import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Captions, Clapperboard, Pencil, Upload } from 'lucide-react'
import { GitHubStars } from '~/components/github-stars.tsx'
import { Badge } from '~/components/ui/badge.tsx'
import { Button } from '~/components/ui/button.tsx'
import { authClient } from '~/lib/auth-client.ts'
import { THEMES } from '~/lib/theme.ts'

export const Route = createFileRoute('/')({ component: Landing })

const STEPS = [
  {
    n: '01',
    icon: Upload,
    title: 'Upload your clip',
    body: 'Presigned PUT straight to R2. The server never touches the bytes, and Whisper starts transcribing right away.',
  },
  {
    n: '02',
    icon: Pencil,
    title: 'Fix words, pick a style',
    body: 'Word-level timestamps from Whisper. Correct what it misheard, choose a caption preset, drag it where you want.',
  },
  {
    n: '03',
    icon: Clapperboard,
    title: 'Export the burn',
    body: 'ffmpeg and libass bake the captions into the pixels. The preview and the export share one positioning formula.',
  },
] as const

function Landing() {
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session?.user)

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-brand/15 blur-[140px]"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Captions className="size-4" />
          </span>
          <span className="font-mono text-base font-bold tracking-tight">subit</span>
        </Link>
        <div className="flex items-center gap-3">
          <a
            href="#how-it-works"
            className="hidden text-sm font-medium text-text-secondary hover:text-foreground sm:block"
          >
            How it works
          </a>
          <GitHubStars />
          {signedIn ? (
            <Button asChild size="sm">
              <a href="/dashboard">Dashboard</a>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/sign-up">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="relative mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className="!h-auto !w-auto !max-w-full !shrink !flex-wrap justify-center gap-2 !whitespace-normal border-border/35 bg-surface-2 px-3 py-1.5 text-center font-mono text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase sm:px-4 sm:text-xs sm:tracking-[0.12em]"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-brand" />
            Open source, runs on your own Node host
          </Badge>
        </div>

        <h1 className="mt-6 text-5xl font-extrabold tracking-tighter text-balance sm:text-7xl">
          Captions that stop the scroll.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-secondary text-pretty">
          Upload a clip, Whisper transcribes it word by word, you fix the words and pick a style,
          and ffmpeg burns the captions into the pixels. What you see in the editor is exactly what
          gets exported.
        </p>

        <div className="mt-9 flex justify-center gap-3">
          {signedIn ? (
            <Button asChild size="lg" className="shadow-lg shadow-brand/25">
              <a href="/dashboard">
                Go to dashboard
                <ArrowRight className="size-4" />
              </a>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="shadow-lg shadow-brand/25">
                <Link to="/sign-up">
                  Start captioning
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/sign-in">See your projects</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-border/35 bg-surface-1/80 p-2 shadow-2xl shadow-black/50">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-1 p-2 sm:grid-cols-5">
            {THEMES.map((t) => (
              <div
                key={t.id}
                className="flex aspect-[4/5] items-center justify-center rounded-xl bg-video-surface p-3"
              >
                <span
                  className="text-center leading-tight"
                  style={{
                    fontFamily: `'${t.fontFamily}', sans-serif`,
                    color: t.primary,
                    fontSize: 22,
                    textTransform: t.uppercase ? 'uppercase' : 'none',
                    WebkitTextStroke: t.outlinePct
                      ? `${t.outlinePct * 3}px ${t.outline}`
                      : undefined,
                    paintOrder: 'stroke fill',
                    backgroundColor: t.boxColor ?? undefined,
                    padding: t.boxColor ? '2px 6px' : undefined,
                  }}
                >
                  <span style={{ color: t.highlight }}>{t.name}</span> style
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-5xl px-6 pb-24">
        <div className="mb-10 text-center">
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Three steps to burned-in captions
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-border/35 bg-surface-2 p-7 shadow-lg shadow-black/25"
            >
              <p className="font-mono text-sm font-bold text-brand">{s.n}</p>
              <s.icon className="mt-3 size-5" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/35 bg-surface-1">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your next clip deserves better captions.
          </h2>
          <p className="mt-4 text-text-secondary">
            Open source. Self-hosted. No watermark, no subscription.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="shadow-lg shadow-brand/25">
              {signedIn ? (
                <a href="/dashboard">
                  Go to dashboard
                  <ArrowRight className="size-4" />
                </a>
              ) : (
                <Link to="/sign-up">
                  Start captioning
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/35">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <span className="flex items-center gap-2">
            <span className="flex size-5.5 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <Captions className="size-3" />
            </span>
            <span className="font-mono text-sm font-bold">subit</span>
          </span>
          <p className="font-mono text-xs text-text-muted">
            Runs on any Node host with ffmpeg. R2 and D1 over HTTPS.
          </p>
          <a
            href="https://github.com/fariraimasocha/subit"
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-xs text-text-secondary hover:text-foreground"
          >
            github.com/fariraimasocha/subit
          </a>
        </div>
      </footer>
    </main>
  )
}
