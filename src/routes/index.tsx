import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button.tsx'
import { THEMES } from '~/lib/theme.ts'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Subit</span>
        <Button asChild size="sm">
          <Link to="/dashboard">Open dashboard</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Captions that land on the word.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
          Drop in an MP4 or MOV. Subit transcribes it with word level timing, groups it into short
          punchy cues, and burns them straight into the video.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/dashboard/new">Upload a video</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">See your projects</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl grid-cols-2 gap-3 px-6 pb-16 sm:grid-cols-5">
        {THEMES.map((t) => (
          <div
            key={t.id}
            className="flex aspect-[4/5] items-center justify-center rounded-xl border bg-neutral-900 p-3"
          >
            <span
              className="text-center leading-tight"
              style={{
                fontFamily: `'${t.fontFamily}', sans-serif`,
                color: t.primary,
                fontSize: 22,
                textTransform: t.uppercase ? 'uppercase' : 'none',
                WebkitTextStroke: t.outlinePct ? `${t.outlinePct * 3}px ${t.outline}` : undefined,
                paintOrder: 'stroke fill',
                backgroundColor: t.boxColor ?? undefined,
                padding: t.boxColor ? '2px 6px' : undefined,
              }}
            >
              <span style={{ color: t.highlight }}>{t.name}</span> style
            </span>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl grid gap-6 px-6 pb-24 sm:grid-cols-3">
        {[
          ['1. Upload', 'MP4 or MOV, portrait or landscape. Rotation and odd codecs get normalised on the way in.'],
          ['2. Edit', 'Pick a preset, drag the caption position, fix anything the model misheard.'],
          ['3. Export', 'A burned in MP4 that matches the preview frame for frame.'],
        ].map(([title, body]) => (
          <div key={title}>
            <h3 className="font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
