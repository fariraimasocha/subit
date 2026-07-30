# Subit: AI subtitle generator (self-hosted Submagic replacement)

> **How to run this.** Do the two manual steps below, then paste the launch command.

```sh
# 1. ffmpeg is NOT installed on this machine. It must be, and it must have libass.
brew install ffmpeg

# 2. Phase 0 deletes the old demo and this is not a git repo yet. No undo without this.
cd /Users/fariraimasocha/Documents/running-projects/subit && git init && git add -A && git commit -m "demo before rewrite"
```

```sh
cd /Users/fariraimasocha/Documents/running-projects/subit && \
claude --dangerously-skip-permissions --remote-control subit-build -n "subit" \
'Read PLAN.md in this directory in full, then build the whole thing, Phase 0 through Phase 7. Do not stop between phases and do not ask me to confirm each one. Run pnpm typecheck after every phase and fix what breaks before moving on. When you are done, give me one list: what works, what is stubbed, and every credential or manual step still outstanding.'
```

---

## What this is

A self-hosted replacement for Submagic. Upload an MP4 or MOV, Groq Whisper transcribes it with word-level timestamps, words are grouped into 1 to 3 word cues, you pick a style preset and fix any mistakes, then export a burned-in MP4.

**The repo currently contains a TanStack Start subscription-tracker demo that has nothing to do with this.** The demo gets deleted in Phase 0. The framework, build config and server boundary stay.

### Locked decisions, do not revisit

| Decision | Choice |
| --- | --- |
| Framework | Keep TanStack Start + Vite. **Not Next.js.** |
| Transcription | Groq `whisper-large-v3-turbo`, word-level timestamps |
| Render engine | **Native ffmpeg** via brew (libass + VideoToolbox). Not ffmpeg.wasm, not `@diffusion-studio/ffmpeg-js`. |
| Scope | **Captions only.** No auto-zoom, no b-roll, no clean audio, no AI thumbnails, no eye contact. |
| Hosting | Local now, VPS later. **Never** Workers or Vercel serverless. |
| Source storage | R2 presigned PUT, copying the `writeonce` aws4fetch pattern |
| Persistence | Cloudflare D1 over the HTTP API, one table |
| Auth | None. Landing page CTA goes straight to the dashboard. |

### Working style

Ponytail mode: the laziest solution that actually works. Fewest files, shortest diff, no speculative abstractions, no interface with one implementation, no config for a value that never changes. Mark deliberate simplifications with a `// ponytail:` comment that names the ceiling and the upgrade path.

Follow `CLAUDE.md`: pnpm only, zustand for global state, TanStack Query with explicit structured query keys, TanStack Table with pagination, shadcn/ui installed through the CLI, react-hot-toast mounted once via `components/providers/ToastProvider`, react-hook-form + zod for forms, and **no em dashes or en dashes in any user-facing copy**.

---

## Prerequisites

```sh
pnpm add aws4fetch @tanstack/react-query @tanstack/react-table zustand \
         react-hot-toast react-hook-form @hookform/resolvers
pnpm add -D tailwindcss @tailwindcss/vite
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add sidebar button card slider input select dialog tabs table separator
```

`.env.local` currently has only `CLOUDFLARE_S3_API` (the R2 endpoint URL), `CLOUDFLARE_ACCOUNT_ID` and `GROQ_API_KEY`. These must be added:

```
R2_ACCESS_KEY_ID=      # create an R2 API token in the Cloudflare dashboard
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=         # https://pub-xxxx.r2.dev or a custom domain
CLOUDFLARE_API_TOKEN=  # needs D1 Edit permission
D1_DATABASE_ID=
EXPORT_ENCODER=libx264
```

**If these are missing, keep building everything that does not depend on them, collect the blocked items into a list, and report at the end. Do not invent placeholder credentials and do not skip work silently.**

R2 bucket CORS (dashboard, R2 > bucket > Settings > CORS). Set this **before** writing the uploader, because the failure mode is an opaque browser error with no server log:

```json
[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["PUT","GET"],
  "AllowedHeaders":["content-type"],"ExposeHeaders":["etag"],"MaxAgeSeconds":3600}]
```

Do not add `content-length` to `AllowedHeaders`. The browser sets it implicitly and Chrome rejects it as a custom header. It is still signed into the presigned query, which is what makes R2 enforce the size.

D1 schema, pasted once by hand into the D1 console:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded|processing|ready|exporting|done|error
  src_key TEXT NOT NULL,
  norm_key TEXT, norm_url TEXT,
  width INTEGER, height INTEGER, duration REAL,
  cues_json TEXT,      -- JSON Cue[]
  theme_json TEXT,     -- full Theme snapshot, not an id
  export_url TEXT, error TEXT,
  created_at INTEGER NOT NULL
);
```

One table. The transcript is always read and written whole and never queried by word, so per-word rows would mean thousands of inserts through an HTTP API for nothing. A 20 minute transcript is roughly 150 KB against D1's 2 MB row limit, so the ceiling is about 4 hours of speech. Store the whole `Theme` rather than an id plus overrides, so editing a preset later never silently restyles finished projects.

`// ponytail: no migration runner. Schema changes are a manual ALTER TABLE in the D1 console.`

D1 client, `src/server/d1.server.ts`:

```ts
const URL_ = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`

export async function d1<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })
  const json = (await res.json()) as any
  if (!res.ok || !json.success) throw new Error(json?.errors?.[0]?.message ?? `D1 ${res.status}`)
  return (json.result[0]?.results ?? []) as T[]
}
```

D1 is reachable only over HTTP here because the app is a Node process, not a Worker. That is a direct consequence of choosing native ffmpeg. The REST API binds params loosely and lets SQLite column affinity do the coercing, so do not `.map(String)` your params.

---

## The crux: one Theme, two renderers

The single biggest risk in this project is the CSS preview and the burned MP4 drifting apart. Get this right before writing either renderer.

**The anti-drift mechanism is that `Theme` contains no pixels.** Every dimension is a percentage of video *height*. Both renderers call the same `metrics()` function; the CSS one passes the on-screen box height, the ASS one passes the real encoded height. A value that cannot be expressed as a percentage of height does not go in the Theme.

`src/lib/theme.ts`:

```ts
export type Theme = {
  id: string; name: string
  fontFamily: string        // MUST match the TTF internal name table, not the filename
  fontFile: string          // basename in public/fonts, feeds @font-face AND ffmpeg fontsdir
  weight: number; uppercase: boolean
  fontSizePct: number       // % of video HEIGHT
  positionPct: number       // % from top to the CENTRE of the caption block
  outlinePct: number; shadowPct: number; letterSpacingEm: number
  primary: string; highlight: string; outline: string
  boxColor: string | null
  highlightMode: 'color' | 'none'
}

/** The only place a percentage becomes a number. Both renderers go through here. */
export function metrics(t: Theme, videoHeight: number) {
  return {
    fontPx: (t.fontSizePct / 100) * videoHeight,
    outlinePx: (t.outlinePct / 100) * videoHeight,
    shadowPx: (t.shadowPct / 100) * videoHeight,
    centreY: (t.positionPct / 100) * videoHeight,
  }
}
```

Presets: Hormozi (Anton, white with yellow highlight, thick outline), Kendrick (Montserrat ExtraBold, black box, cyan highlight), Beast (Anton, green highlight), plus clean and minimal. **Adding a preset is a data entry, never new code.**

`// ponytail:` `highlightMode` has no box-behind-active-word and no pop-scale. ASS cannot draw a per-span background without measuring glyph widths and emitting a `\p1` drawing layer, and per-span `\fscx` reflows the line so the CSS preview would drift. Ceiling: Beast-style yellow-box-on-active-word is out of v1.

### Renderer A, CSS overlay (`src/components/caption-overlay.tsx`)

Two details that matter: `paintOrder: 'stroke fill'` reproduces the libass draw order (outline behind fill), and `WebkitTextStroke` is centred on the glyph path while ASS `Outline` sits outside it, hence `outlinePx * 2`. Eyeball this once against a burned frame and bake the fudge factor into that line.

**Letterboxing trap:** if the `<video>` is letterboxed inside its element, the measured height is wrong. Kill it structurally, do not measure around it. Wrapper gets `aspect-ratio: ${w}/${h}; width:100%; position:relative`, video gets `width:100%; height:100%; display:block`. One `ResizeObserver` then gives the true painted height.

Drive it with `requestAnimationFrame`, not `timeupdate` (which fires roughly 4 times a second and would visibly lag the word highlight):

```ts
const cursor = useRef(0)
const tick = () => {
  const t = videoRef.current?.currentTime ?? 0
  let i = cursor.current
  if (i >= cues.length || cues[i].start > t) i = 0        // seek backwards, reset
  while (i < cues.length - 1 && cues[i].end < t) i++
  cursor.current = i
  // ponytail: linear cursor walk, not a binary search. O(n) worst case on a full
  // seek is microseconds at a few thousand cues. Ceiling ~50k cues (5+ hours).
}
```

Keep `currentTime` **out of zustand**. Sixty store writes per second would rerender the whole editor. The overlay owns local state; zustand holds only `theme`, `captionsVisible`, `aspect`, `selectedCueId`.

### Renderer B, ASS (`src/lib/ass.ts`)

Pure and shared, importable from the client so the string can be diffed in devtools. Three things everyone gets wrong:

```ts
// 1. ASS colour is &HAABBGGRR& with AA=00 meaning OPAQUE.
//    Byte order reversed, alpha inverted.
const bgr = (hex: string, alphaHex = '00') => {
  const h = hex.replace('#', '').slice(0, 6)
  return `&H${alphaHex}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`
}
// 2. PlayResX/PlayResY MUST equal the encoded frame size. libass scales
//    PlayRes -> frame, so a mismatch silently shifts every \pos and rescales
//    every font. They come from the same probe that produced the file being
//    burned. Never let a caller pass them in separately.
// 3. ASS booleans are -1/0, not 1/0. BorderStyle 3 = opaque box, 1 = outline.
//    Alignment 5 = middle-centre, which matches CSS translate(-50%,-50%).
//    WrapStyle 2 = no auto wrap; 1 to 3 word cues never need it.
```

Active-word highlight: emit **one Dialogue event per word**, with `{\1c<highlight>}word{\1c<primary>}` around the active token.

`// ponytail:` one event per word rather than `\k` karaoke tags. Three times the lines, zero karaoke-renderer semantics to reason about, and it is the exact same "recolour the active span" operation the DOM overlay performs, which is what keeps the two honest.

---

## Pipeline

Every job runs in `fs.mkdtemp(path.join(os.tmpdir(), 'subit-'))` with children spawned at `cwd: jobDir`, so filenames stay bare and the `subtitles=` filter never needs escaping.

**1. Normalize on ingest.** ffmpeg reads the R2 object over HTTPS directly, so there is no download step and no source temp file.

```
ffmpeg -y -i "<presigned GET url>" \
  -vf "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:v h264_videotoolbox -b:v 8M -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart norm.mp4
```

One pass solves four problems: MOV, HEVC and ProRes that Chrome will not play in the preview; iPhone rotation metadata (baked into pixels, display matrix dropped, so pixels and ASS coordinates finally agree); ambiguous ffprobe dimensions; and oversized source resolution.

`// ponytail: always normalize, even a clean 1080p h264 mp4. Detecting the skip case costs more code than the wasted transcode costs seconds.`

`norm.mp4` goes back to R2 and is what the editor plays **and** what the export burns.

**2. Probe `norm.mp4`, never the original.**

```
ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
  -show_entries format=duration -of json norm.mp4
```

Persist width, height and duration on the project row. `toAss()` uses exactly these numbers.

**3. Audio for Groq.**

```
ffmpeg -y -i norm.mp4 -vn -map 0:a:0 -ar 16000 -ac 1 -c:a flac -compression_level 8 audio.flac
```

16 kHz mono FLAC is roughly 18 KB/s, so the 25 MB free-tier cap is about 23 minutes. Over 20 minutes, slice with `-ss <n*600> -t 600`, transcribe sequentially, and add `n * 600` to every word timestamp before concatenating. About 12 lines.

`// ponytail: sequential, not parallel. A 60 minute video costs three round trips instead of one.`

**4. Groq.** Plain `fetch` with `FormData`. No `groq-sdk` dependency.

```ts
const fd = new FormData()
fd.append('file', new Blob([await readFile(flacPath)], { type: 'audio/flac' }), 'audio.flac')
fd.append('model', 'whisper-large-v3-turbo')
fd.append('response_format', 'verbose_json')
fd.append('timestamp_granularities[]', 'word')     // repeated key WITH the []
fd.append('timestamp_granularities[]', 'segment')  // suffix, NOT a JSON array string
fd.append('temperature', '0')
const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  body: fd,
})
```

The `[]` bracket suffix is the single most common failure here. Get it wrong and you silently receive segments with no `words` array. Groq accepts flac, mp3, mp4, m4a, wav, webm and ogg. It does **not** accept `.mov`, which is one more reason the normalize pass is mandatory.

**5. Group into cues** (`src/lib/cues.ts`, pure, unit tested with the repo's existing `node:test` setup):

Defaults `maxWords: 3, maxChars: 20, gapMs: 350, maxDurMs: 1800`. Hard break after `.?!`. Break after `,;:` only when the cue already has 2 or more words, so single-word fragments do not flash by. Then hold each cue through gaps under 800ms by up to 140ms so captions do not strobe.

The same file exports `splitCue`, `mergeCues` and `retime`. All pure, all reused by the transcript editor. Editing a word's text never touches timings, which is exactly what "fix Whisper mistakes" means.

**6. Burn.** Write `cues.ass` and copy the theme TTF into `jobDir/fonts/`.

```
ffmpeg -y -i norm.mp4 -vf "subtitles=cues.ass:fontsdir=fonts" \
  -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p \
  -c:a copy -movflags +faststart out.mp4 \
  -progress pipe:1 -nostats -loglevel warning
```

**VideoToolbox for normalize, libx264 for export.** VideoToolbox has no CRF and at matched bitrate visibly loses detail on high-contrast caption edges, which is the one thing this product exists to render. Normalize output is intermediate so nobody sees it. `EXPORT_ENCODER` env lets a slow VPS flip it.

**7. Export progress.** `-progress pipe:1` emits clean `key=value` lines on **stdout**, which is far nicer than regexing the human-readable stderr banner. Parse `out_time_us=` against duration, and `progress=end`.

```ts
// src/server/jobs.server.ts
// ponytail: in-memory Map. Ceiling: single process, single machine. Restart the
// server mid-export and the job vanishes (the UI shows "lost, retry"). Fixing it
// means a jobs table plus a reaper, which is a queue, which is what we said no to.
type Job = { status: 'running' | 'done' | 'error'; pct: number; url?: string; error?: string }
export const jobs = new Map<string, Job>()
```

**Poll, do not use SSE.** TanStack Query is already mandated by CLAUDE.md, so polling is one line: `refetchInterval: (q) => q.state.data?.status === 'running' ? 750 : false`. SSE needs a stream controller, an `EventSource`, a heartbeat to survive proxy idle timeouts and manual unmount cleanup, all to shave latency off a progress bar nobody is measuring.

`startExport` returns `{ jobId }` immediately and lets the promise run detached. That is fine on a long-lived Node process and broken on serverless, which is the concrete reason serverless is off the table. Put that in a comment next to it so nobody tries to deploy this to Workers.

---

## UI, from the Submagic reference screenshots

1. **Landing**, one page, no auth, CTA goes to `/dashboard`.
2. **Dashboard** with a shadcn sidebar: Home, Projects, New Project.
3. **New project** page: upload card with drag and drop, accepting MP4 and MOV.
4. **Editor**, two columns.
   - Left: Caption Style picker, a grid of named preset chips each rendered in its own style, plus bottom controls for Caption Position (%), Font size (px), Font, and Main / Second / Third colour swatches.
   - Right: video preview with the live caption overlay, play/pause, timeline scrubber, aspect ratio selector, and a Captions visibility toggle.
5. **Transcript panel**: fix Whisper mistakes, retime, split and merge cues.
6. **Export** to a burned-in MP4 with a progress bar.

Sidebar shell pattern comes from `/Users/fariraimasocha/Documents/running-projects/utashiadmin`:

```jsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <AppTopbar />
    <div className="flex-1 p-4 md:p-8">{children}</div>
  </SidebarInset>
</SidebarProvider>
```

Note that utashiadmin uses the Base UI flavour of shadcn (`render={<Link/>}`). **Subit gets a fresh standard Radix install, so use `asChild`**, adapted to TanStack Router's `Link`.

Upload pattern comes from `/Users/fariraimasocha/Documents/running-projects/writeonce` (`lib/r2.js`, `utils/upload.js`, `components/dashboard/ImageLibrary.jsx`):

- `aws4fetch` `AwsClient`, not `@aws-sdk`. `presignPutUrl` signs content-type **and** content-length into the query so R2 itself enforces the size.
- `buildKey` returns `${scope}/${crypto.randomUUID()}.${ext}`.
- `XMLHttpRequest` PUT for `upload.onprogress`, because `fetch` has no upload progress.
- Whole-page dropzone with the `e.currentTarget.contains(e.relatedTarget)` guard on `onDragLeave` to stop flicker, and `e.target.value = ""` after change so re-picking the same file re-fires.

---

## Files

**Delete in Phase 0, and nothing else:**
`src/routes/index.tsx`, `src/routes/stats.tsx`, `src/routes/settings.tsx`, `src/routes/subs.$id.tsx`, `src/server/subs.ts`, `src/server/db.server.ts`, `src/select.ts`, `src/select.test.ts`, `src/schemas.ts`, `src/styles.css`.

**Keep:** `vite.config.ts` (the `importProtection` on `*.server.ts` is the server boundary and it stays), `serve.ts`, `src/router.tsx`, `tsconfig.json`.

| File | Purpose |
| --- | --- |
| `src/lib/theme.ts` | `Theme`, `metrics()`, `THEMES`. Source of truth for both renderers. |
| `src/lib/cues.ts` | `Word`/`Cue`, `groupWords`, `splitCue`, `mergeCues`, `retime`. Pure. |
| `src/lib/cues.test.ts` | `node:test` coverage for grouping and split/merge edges. |
| `src/lib/ass.ts` | `toAss(cues, theme, w, h)`. Pure. |
| `src/server/r2.server.ts` | aws4fetch presignPut/presignGet/putObject/buildKey, lifted from writeonce. |
| `src/server/d1.server.ts` | `d1(sql, params)` plus the five project queries. |
| `src/server/ffmpeg.server.ts` | `probe`, `normalize`, `extractAudio`, `burn`, tmpdir lifecycle. Raw `spawn`, no wrapper lib. |
| `src/server/groq.server.ts` | Multipart fetch to Whisper, chunking for long audio, returns `Word[]`. |
| `src/server/jobs.server.ts` | Job Map, `runIngest()`, `runExport()`. |
| `src/server/api.ts` | All `createServerFn`: presign, create/list/getProject, saveCues, saveTheme, startExport, getJob. |
| `src/store/editor.ts` | zustand: theme, captionsVisible, aspect, selectedCueId. **Not currentTime.** |
| `src/globals.css` | Tailwind v4 `@import`, `@theme inline`, `@font-face` per caption font. |
| `src/routes/__root.tsx` | Shell, globals.css, QueryClientProvider, ToastProvider. |
| `src/routes/index.tsx` | One-page landing, CTA to /dashboard. |
| `src/routes/dashboard.tsx` | SidebarProvider + AppSidebar + SidebarInset + Outlet. |
| `src/routes/dashboard.index.tsx` | Home, recent projects. |
| `src/routes/dashboard.projects.tsx` | TanStack Table with pagination. |
| `src/routes/dashboard.new.tsx` | Upload card, drag and drop, XHR presigned PUT, redirect to editor. |
| `src/routes/editor.$id.tsx` | Two-column editor, layout only. |
| `src/components/app-sidebar.tsx` | shadcn sidebar, Radix flavour, adapted to TanStack `Link`. |
| `src/components/video-player.tsx` | `<video>` + aspect wrapper + scrubber + play/pause + captions toggle. |
| `src/components/caption-overlay.tsx` | The rAF DOM renderer. |
| `src/components/style-panel.tsx` | Preset grid + position/size/font/colour controls. |
| `src/components/transcript-panel.tsx` | Editable cue list, split/merge/retime. |
| `src/components/providers/ToastProvider.tsx` | react-hot-toast mount, per CLAUDE.md. |
| `public/fonts/*.ttf` | Anton, Montserrat ExtraBold. Feed both `@font-face` and ffmpeg `fontsdir`. |

`src/server/api.ts` statically importing `*.server.ts` is safe. The existing `src/server/subs.ts` already does exactly that, and `importProtection` is satisfied because Start strips server-fn handlers from the client bundle.

TanStack Start reference: server functions are `createServerFn({ method }).validator(zodSchema).handler(async ({ data }) => ...)`. Server routes, if ever needed, are `createFileRoute('/api/x')({ server: { handlers: { GET: async ({ request }) => Response } } })`. Server functions alone cover this whole app, so do not add server routes.

---

## Build order

Each phase ends in something runnable. Run `pnpm typecheck` after every phase.

0. **Demolition.** Delete the demo files listed above, install deps, shadcn init, Tailwind v4 via the Vite plugin, landing page, empty dashboard shell.
   *Verify:* `pnpm dev`, click the CTA, land on a sidebar layout.
1. **Storage round trip.** `r2.server.ts`, `d1.server.ts`, presign server fn, drag and drop uploader with XHR progress.
   *Verify:* drop an MOV, watch the progress bar, see the object in R2 and the row in D1.
2. **ffmpeg by hand.** normalize + probe + extractAudio via `runIngest`.
   *Verify:* `norm.mp4` plays in Chrome, an upside-down iPhone clip comes out upright, `audio.flac` is under 25 MB.
3. **Words on disk.** `groq.server.ts` + `groupWords` + persist `cues_json`.
   *Verify:* `pnpm test` passes, a real project row holds sensible 1 to 3 word cues.
4. **The preview.** `theme.ts` + overlay + player + style panel.
   *Verify:* captions ride the video, the active word changes colour on beat, the position slider moves them, resizing the window keeps them proportional.
5. **The transcript.** Edit, split and merge through a `useMutation` that invalidates `['project', id]`.
   *Verify:* fix a misheard word, the preview updates without a reload.
6. **Export.** `ass.ts` + burn + job Map + polling + upload result.
   *Verify:* the downloaded MP4 is frame for frame what the preview showed. Theme drift becomes visible here, which is exactly why this lands after Phase 4 and not before.
7. **Polish.** Projects table pagination, toasts on every mutation, empty states, error surfaces. Run CodeRabbit per CLAUDE.md and apply the findings that are real.

---

## What will bite

- **ffmpeg font loading.** `fontsdir` matches the font's *internal family name*, not the filename. A mismatch means libass silently falls back to a default sans with no error, and the export looks nothing like the preview. Burn once with `-loglevel verbose` and grep `fontselect` to see which family it actually chose. Copy the TTF into `jobDir/fonts/` rather than pointing at `public/fonts`, so the spawn `cwd` relative path works.
- **`subtitles=` filter escaping.** The filter value is parsed twice, so a path containing `:` or `\` or `'` needs double escaping. Sidestep it entirely: spawn with `cwd: jobDir` and pass bare `cues.ass`.
- **MOV rotation.** iPhone portrait video is stored landscape with a 90 degree display matrix. `ffprobe stream=width,height` on the original reports the storage dims, so ASS `PlayResX/Y` would be transposed and every caption would land off frame. Always probe `norm.mp4`.
- **PlayRes mismatch.** If `PlayResX/PlayResY` differ from the encoded frame, libass scales and `\pos` coordinates plus font size drift proportionally. Keep the probe and the ASS generation wired together in one function.
- **R2 CORS.** Absent on a fresh bucket, and the failure is an opaque browser CORS error with no server log. Set it in Phase 1 before writing the uploader.
- **Groq 25 MB.** Roughly 23 minutes of 16 kHz mono FLAC. Until chunking ships, put a hard duration check at upload time with a clear message rather than surfacing a 413 as "something went wrong".
- **Temp cleanup.** `fs.rm(dir, { recursive: true, force: true })` in a `finally`, and *after* the R2 upload resolves, not before. A crash mid-job leaks a directory of multi-gigabyte intermediates. `// ponytail: no reaper. macOS clears /tmp on reboot; a VPS eventually needs a tmpreaper cron.`
- **`-c:a copy` on export** is valid only because normalize already produced AAC. If someone later removes the normalize step, this silently fails on non-AAC sources.
- **Detached export promise** works on a long-lived Node process. Write the reason next to `startExport` so nobody tries serverless.

---

## Final verification

`pnpm dev`, drop a portrait iPhone `.mov` on `/dashboard/new`, wait for transcription, pick Hormozi, drag the position slider, fix one misheard word, hit Export, download the MP4, and confirm the burned captions match the preview in position, size, colour and word timing.

`pnpm test` for `cues.ts` and `pnpm typecheck` throughout.
