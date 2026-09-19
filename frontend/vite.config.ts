/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// AdSense wants its snippet in the served <head> of every page (its site
// verification reads the HTML source, and prerender.mjs derives both the
// landing page and the SPA shell from this built index.html — ADR-0027).
// Emitted only when VITE_ADSENSE_CLIENT_ID is set, so dev/CI builds stay
// free of Google requests.
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Same bar as the backend's pytest-cov gate (backend/pyproject.toml).
      thresholds: {
        lines: 80,
        branches: 80,
      },
    },
  },
}))
