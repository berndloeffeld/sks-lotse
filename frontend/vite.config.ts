/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { parseChartFlag } from './src/sks/chartFlag.ts'

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A typo in a flag value fails the build rather than falling back (ADR-0056).
  parseChartFlag(env.VITE_CHART_EXERCISES)
  return {
    plugins: [react(), tailwindcss()],
    // `vite build --ssr` (package.json) renders the pages for scripts/prerender.mjs.
    build: isSsrBuild ? { rolldownOptions: { input: { 'entry-server': 'src/sks/entry-server.tsx' } } } : {},
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
