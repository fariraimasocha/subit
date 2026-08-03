# Subit

Burn word-by-word captions into short-form video. Upload a clip, Whisper
transcribes it, you fix the words and pick a style, and ffmpeg renders an MP4
with the captions baked into the pixels.

The editor preview and the exported file share one positioning formula, so what
you see is what gets burned.

```sh
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # node:test, no test framework
pnpm typecheck
pnpm build && pnpm start
```

## What runs where

Storage and database are Cloudflare. **The app itself is not a Worker.**

| Piece | Runs on | Why |
| --- | --- | --- |
| Video + exports | Cloudflare R2 | Presigned PUT straight from the browser, so uploads never touch the app server. |
| Project rows | Cloudflare D1 | Reached over the REST API, not a binding, because the app is a Node process. |
| Transcription | Groq Whisper | `whisper-large-v3-turbo`, word-level timestamps. |
| The app + rendering | **Any Node host** | `ffmpeg` is spawned as a native process. |

Two things put Workers and Vercel off the table for the app process itself:

1. Rendering shells out to a real `ffmpeg` binary (`src/server/ffmpeg.server.ts`).
2. Ingest and export run detached from the request that started them
   (`src/server/jobs.server.ts`). Serverless freezes the function once the
   response is sent, which would kill every job mid-flight.

So deploy the app to a VPS, Fly, Render, Railway, or anything else that gives you
a long-lived process with ffmpeg on it. R2 and D1 are reached over HTTPS from
wherever that is.

## Prerequisites

- **Node 22+** and **pnpm 10+**
- **ffmpeg built with libass.** Non-negotiable: without it the `subtitles` filter
  does not exist and every export fails.

Homebrew splits this into a slim `ffmpeg` (no libass) and a keg-only
`ffmpeg-full`. Install the full one:

```sh
brew install ffmpeg-full
```

Verify libass is present. This must print a non-zero number:

```sh
ffmpeg -filters | grep -c subtitles
```

If your binary is not on `PATH`, set `FFMPEG_BIN` and `FFPROBE_BIN`. The resolver
in `src/server/ffmpeg.server.ts` already checks the Homebrew keg path
(`/opt/homebrew/opt/ffmpeg-full/bin`) before falling back to `PATH`.

## Setup

### 1. Cloudflare R2

Create a bucket, then set its CORS rules **before** your first upload. A missing
CORS rule fails as an opaque browser error with no server log, which is a
miserable thing to debug.

R2 > your bucket > Settings > CORS:

```json
[{"AllowedOrigins":["http://localhost:3000"],"AllowedMethods":["PUT","GET"],
  "AllowedHeaders":["content-type"],"ExposeHeaders":["etag"],"MaxAgeSeconds":3600}]
```

Do not add `content-length` to `AllowedHeaders`. The browser sets it implicitly
and Chrome rejects it as a custom header. It is still signed into the presigned
query, which is what makes R2 enforce the upload size.

Then mint an R2 token: R2 > Manage API tokens > Create token, with **Object Read
& Write** on that bucket. This gives you `R2_ACCESS_KEY_ID` and
`R2_SECRET_ACCESS_KEY`. These cannot be created from the CLI, only the dashboard.

### 2. Cloudflare D1

Create a database, then paste this into the D1 console once. There is no
migration runner, schema changes are a manual `ALTER TABLE`.

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
  stage TEXT,          -- normalising|uploading|transcribing|grouping
  created_at INTEGER NOT NULL
);
```

`stage` is easy to miss: `PLAN.md` predates it and the live database picked it up
through a later `ALTER TABLE`. Leave it out and ingest fails on the first status
write.

Then create an account API token: My Profile > API Tokens > Create token, with
**D1 Edit** on this account. That is `CLOUDFLARE_API_TOKEN`, and it is a
different credential from the R2 keys above.

### 3. Groq

Get a key from [console.groq.com](https://console.groq.com). The free tier is
enough to transcribe plenty of clips.

### 4. `.env.local`

```sh
# Cloudflare account, R2 > Overview or any dashboard URL
CLOUDFLARE_ACCOUNT_ID=
# R2 S3 endpoint, e.g. https://<account>.r2.cloudflarestorage.com
# Accepted with or without the bucket name on the end.
CLOUDFLARE_S3_API=
R2_BUCKET=

# R2 > Manage API tokens > Create token (Object Read & Write on the bucket)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# My Profile > API Tokens > Create token, with D1 Edit on this account
CLOUDFLARE_API_TOKEN=
D1_DATABASE_ID=

# console.groq.com
GROQ_API_KEY=
```

Everything below is optional:

| Variable | Default | What it does |
| --- | --- | --- |
| `R2_PUBLIC_URL` | blank | Public bucket URL (`https://pub-xxxx.r2.dev` or a custom domain). Left blank, `publicUrl()` falls back to a 7 day presigned GET, which works without enabling public access. Never point this at the S3 API endpoint: those URLs need signing and the browser just gets a 400. |
| `EXPORT_ENCODER` | `libx264` | Export video encoder. `h264_videotoolbox` is faster on Apple silicon but visibly loses detail on caption edges. |
| `FFMPEG_BIN` / `FFPROBE_BIN` | auto | Explicit binary paths, if the Homebrew keg and `PATH` both miss. |
| `GITHUB_REPO` | `fariraimasocha/subit` | Repo behind the landing page star count. |
| `GITHUB_TOKEN` | blank | Lifts the GitHub API limit from 60/hour to 5000/hour. Only needed if the star count rate-limits. |
| `PORT` | `3000` | Production port for `pnpm start`. |

A fresh clone with missing credentials explains itself: the dashboard renders a
setup checklist instead of a failed request. See `src/components/setup-notice.tsx`.

## How a video moves through

1. **Upload.** The browser gets a presigned PUT and sends the file straight to
   R2. The app server never receives the bytes.
2. **Normalize.** One ffmpeg pass solves four problems at once: containers Chrome
   will not play (MOV, HEVC, ProRes), iPhone rotation metadata (baked into pixels
   here, so pixels and caption coordinates finally agree), ambiguous ffprobe
   dimensions, and oversized resolution (capped at 1920).
3. **Transcribe.** Audio is extracted as 16 kHz mono FLAC and sent to Groq.
   That is roughly 18 KB/s, so Groq's 25 MB cap works out to about 23 minutes
   per request; longer clips are chunked.
4. **Edit.** Fix misheard words, pick a caption preset, drag the caption where
   you want it.
5. **Export.** Cues become an ASS subtitle file, ffmpeg burns it in with libass,
   and the result goes back to R2.

Ingest and export both run detached and report progress through a polled
in-memory job map.

## Preview and export agree by construction

Two renderers draw the same captions: a DOM overlay in the browser
(`src/components/caption-overlay.tsx`) and an ASS subtitle file burned by libass
(`src/lib/ass.ts`). They stay honest because every number in both comes from one
`metrics()` call in `src/lib/theme.ts`, as a percentage of the frame height.

Both anchor the caption block on its vertical centre: CSS uses
`translate(-50%, -50%)`, ASS uses `Alignment 5`. The export then subtracts a
small per-font baseline shift, because CSS centres text on hhea metrics while
libass uses the OS/2 win pair. Without that correction the burn sits a few pixels
off from the preview. `src/lib/ass.test.ts` pins those numbers down.

One known gap: the aspect selector (9:16, 1:1, 16:9) crops the **preview** only.
The export always keeps the source frame, so on anything other than Source the
same position percentage lands differently.

## Known simplifications

- **Jobs live in an in-memory Map.** Restart the server mid-export and the job
  vanishes; the UI says so and offers a retry. Fixing it properly means a jobs
  table plus a reaper, which is a queue.
- **No migration runner.** Schema changes are a manual `ALTER TABLE` in the D1
  console.
- **One row per project**, transcript and theme stored as JSON. The transcript is
  always read and written whole and never queried by word. A 20 minute transcript
  is about 150 KB against D1's 2 MB row limit, so the ceiling is roughly 4 hours
  of speech.
- **No temp file reaper.** macOS clears `/tmp` on reboot; a long-running VPS
  eventually wants a `tmpreaper` cron.

## Layout

```
src/
  routes/          file-based routing, dashboard + editor
  components/      shadcn/ui base, caption overlay, style panel
  lib/             theme, cues, ASS generation (shared, client-safe)
  server/          *.server.ts, unreachable from client code by build rule
  store/           zustand editor state
public/fonts/      TTFs shipped to libass at burn time
serve.ts           the only runtime-specific file in the repo
```

`vite.config.ts` sets `importProtection`, so any client module importing a
`*.server.ts` file is a build error rather than a runtime surprise.
