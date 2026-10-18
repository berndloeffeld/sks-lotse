/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { parseChartFlag } from './src/chartFlag.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // A typo in the Kartenaufgaben flag fails the build rather than falling back to "off" (ADR-0056).
  parseChartFlag(env.VITE_CHART_EXERCISES)
  return {
    plugins: [react(), tailwindcss()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Vitest's default for `run` is one worker less than the cores, which leaves a quarter of
      // GitHub's 4-vCPU runner idle in a CPU-bound run; locally the default keeps the machine usable.
      maxWorkers: process.env.CI ? 4 : undefined,
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
