import { afterEach, describe, expect, it, vi } from 'vitest'

import { initAnalytics, trackEvent } from './analytics'

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

describe('trackEvent', () => {
  afterEach(() => {
    delete window.umami
  })

  it('is a no-op while the Umami script is not loaded', () => {
    expect(() => trackEvent('login')).not.toThrow()
  })

  it('forwards the event and its properties to Umami', () => {
    const track = vi.fn()
    window.umami = { track }

    trackEvent('question_graded', { outcome: 'richtig' })

    expect(track).toHaveBeenCalledWith('question_graded', { outcome: 'richtig' })
  })

  it('never lets a failing tracker break the app', () => {
    window.umami = {
      track: () => {
        throw new Error('blocked')
      },
    }

    expect(() => trackEvent('login')).not.toThrow()
  })
})
