import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

// Read once at config time so the sidebar's version string cannot drift from
// the release, without pulling all of package.json into the client bundle.
const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // The explicit server boundary. Anything matching `*.server.ts` is a build
      // error if a client module reaches it, so `src/server/db.server.ts` can
      // only ever be touched through a server function.
      importProtection: {
        enabled: true,
        behavior: 'error',
        client: { files: [/\.server\.[jt]sx?$/] },
      },
    }),
    viteReact(),
  ],
})
