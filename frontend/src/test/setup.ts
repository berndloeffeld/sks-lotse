import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { checkLimitsSource } from '../checkLimits'
import type { PublicPricing } from '../api/types'

const PRICING = {
  catalog_check_tokens: 1,
  chart_check_tokens: 2,
  check_max_answer_chars: 1000,
} as PublicPricing

// Not using Vitest's `globals: true` (explicit imports only, per this
// project's style) means @testing-library/react's auto-cleanup — which
// hooks itself into a global `afterEach` — never runs on its own; wire it up
// explicitly so each test starts from an empty DOM.
afterEach(() => {
  cleanup()
})

// jsdom doesn't implement layout, so it has no scrollIntoView; stub it so
// components that scroll an element into view don't crash under test.
Element.prototype.scrollIntoView = () => {}

// Nor window.scrollTo (it logs "Not implemented" and does nothing); useNavigationScroll calls it
// on every in-app navigation.
window.scrollTo = () => {}

// Node 25+ brings a global localStorage of its own, undefined unless started with --localstorage-file,
// and it shadows jsdom's. Hand the tests jsdom's working one.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom
if (typeof window.localStorage === 'undefined' && dom) {
  Object.defineProperty(window, 'localStorage', { value: dom.window.localStorage, configurable: true })
}

// The Lotsen-Check screens ask GET /pricing for the check costs (checkLimits.ts). Tests start with
// the answer already there, so none of them has to expect or mock that request; checkLimits.test.ts
// resets it to test the fetch itself.
beforeEach(() => {
  checkLimitsSource.prime(PRICING)
})
