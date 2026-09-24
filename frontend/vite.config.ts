/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// AdSense wants its snippet in the served <head> of the public pages (its site
// verification reads the HTML source — ADR-0027). prerender.mjs derives the
// public pages and the SPA shell from this built index.html and strips the tag
// from the shell, which loads it at runtime only where wanted (ads.ts,
// ADR-0027 addendum 2026-09-23). Emitted only when VITE_ADSENSE_CLIENT_ID is
// set, so dev/CI builds stay free of Google requests.
function adsenseSnippet(clientId: string | undefined): Plugin {
  return {
    name: 'adsense-snippet',
    transformIndexHtml() {
      if (!clientId) return []
      return [
        {
          tag: 'script',
          attrs: {
            async: true,
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`,
            crossorigin: 'anonymous',
          },
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), adsenseSnippet(loadEnv(mode, process.cwd(), 'VITE_').VITE_ADSENSE_CLIENT_ID)],
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
        lines: 90,
        branches: 85,
      },
    },
  },
}))
