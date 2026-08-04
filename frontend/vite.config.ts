import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // fsevents is a native, Darwin-only optional dependency pulled in by
  // Vite/Playwright's own file watchers — it's never imported by app code,
  // but the rolldown-based dependency optimizer trips trying to parse the
  // .node binary if it gets scanned. Keep it out of the scan entirely.
  optimizeDeps: { exclude: ['fsevents'] },
  ssr: { external: ['fsevents'] },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
