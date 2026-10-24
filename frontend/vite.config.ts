/// <reference types="vitest/config" />
import { readFileSync, readdirSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import { parseChartFlag } from './src/sks/chartFlag.ts'
import { parseSbfFlag } from './src/shared/sbfFlag.ts'
import { parseSite, type Site } from './src/shared/site.ts'

// The SBF build's page is index.sbf.html instead of index.html (ADR-0067): its own head (title,
// canonical, structured data, theme color) and its own entry, src/sbf/main.tsx, so the SKS app —
// its routes, the session check, the catalog — never reaches sbf-lotse.de. Swapped before Vite
// processes the page, so both are built alike; index.html stays the SKS page every test reads.
function sitePage(site: Site): Plugin {
  return {
    name: 'site-page',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => (site === 'sbf' ? readFileSync(new URL('./index.sbf.html', import.meta.url), 'utf8') : html),
    },
  }
}

// The Navigationsaufgaben's originals as the PDF prints them (ADR-0068), served at /navigation/originals/:
// only by an SBF build with VITE_SBF=on. Not in public-sbf/, which every SBF build ships whatever the
// flag says; with "off" no task may be on sbf-lotse.de (scripts/check-sbf-build.mjs checks it).
const ORIGINALS_DIR = new URL('./src/sbf/navigation/originals/', import.meta.url)

function navigationOriginals(enabled: boolean): Plugin {
  const files = () => readdirSync(ORIGINALS_DIR).filter((name) => name.endsWith('.png'))
  return {
    name: 'navigation-originals',
    generateBundle() {
      if (!enabled) return
      for (const name of files()) {
        this.emitFile({
          type: 'asset',
          fileName: `navigation/originals/${name}`,
          source: readFileSync(new URL(name, ORIGINALS_DIR)),
        })
      }
    },
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use('/navigation/originals/', (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0]
        if (!files().includes(name)) return next()
        res.setHeader('Content-Type', 'image/png')
        res.end(readFileSync(new URL(name, ORIGINALS_DIR)))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A typo in a site or flag value fails the build rather than falling back (ADR-0056, ADR-0067).
  parseChartFlag(env.VITE_CHART_EXERCISES)
  const site = parseSite(env.VITE_SITE)
  const sbf = parseSbfFlag(env.VITE_SBF)
  if (site !== 'sbf' && env.VITE_SBF) {
    throw new Error(`VITE_SBF is for the SBF build only (VITE_SITE=sbf) — got it with VITE_SITE=${site}`)
  }
  return {
    plugins: [react(), tailwindcss(), sitePage(site), navigationOriginals(site === 'sbf' && sbf === 'on')],
    // Each site serves its own icons, manifest, robots.txt and security.txt; the SKS images
    // (catalog, charts, screenshots) stay off sbf-lotse.de.
    publicDir: site === 'sbf' ? 'public-sbf' : 'public',
    // `vite build --ssr` (package.json) renders the build's own site for scripts/prerender.mjs.
    build: isSsrBuild
      ? {
          rolldownOptions: {
            input: { 'entry-server': site === 'sbf' ? 'src/sbf/entry-server.tsx' : 'src/sks/entry-server.tsx' },
          },
        }
      : {},
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Reset before every test, so a test's teardown (the DOM cleanup in
      // setup.ts) still runs with its own stubs in place.
      unstubGlobals: true,
      unstubEnvs: true,
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // A few points under the actual values, like the backend's pytest-cov
        // gate (backend/pyproject.toml); see CLAUDE.md → Test Coverage.
        thresholds: {
          lines: 95,
          branches: 90,
        },
      },
    },
  }
})
