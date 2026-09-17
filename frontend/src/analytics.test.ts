import { afterEach, describe, expect, it, vi } from 'vitest'

import { initAnalytics } from './analytics'

function umamiScript() {
  return document.head.querySelector<HTMLScriptElement>('script[data-website-id]')
}

describe('initAnalytics', () => {
  afterEach(() => {
    umamiScript()?.remove()
    vi.unstubAllEnvs()
  })

  it('does nothing when no website id is configured', () => {
    initAnalytics()

    expect(umamiScript()).toBeNull()
  })

  it('injects the Umami script tag when a website id is configured', () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'test-id')

    initAnalytics()

    const script = umamiScript()
    expect(script).not.toBeNull()
    expect(script?.src).toBe('https://cloud.umami.is/script.js')
    expect(script?.defer).toBe(true)
    expect(script?.dataset.websiteId).toBe('test-id')
  })
})
