import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Not using Vitest's `globals: true` (explicit imports only, per this
// project's style) means @testing-library/react's auto-cleanup — which
// hooks itself into a global `afterEach` — never runs on its own; wire it up
// explicitly so each test starts from an empty DOM.
afterEach(() => {
  cleanup()
})
