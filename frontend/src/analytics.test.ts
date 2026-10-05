import { afterEach, describe, expect, it, vi } from 'vitest'

import { initAnalytics, trackEvent, wantsAnalytics } from './analytics'

function umamiScript() {
  return document.head.querySelector<HTMLScriptElement>('script[data-website-id]')
}

describe('initAnalytics', () => {
  afterEach(() => {
    umamiScript()?.remove()
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

  it('stays out of the admin tools but loads on /pricing', () => {
    vi.stubEnv('VITE_UMAMI_WEBSITE_ID', 'test-id')

    initAnalytics('/admin/users')
    expect(umamiScript()).toBeNull()

    initAnalytics('/pricing')
    expect(umamiScript()).not.toBeNull()
  })
})

describe('wantsAnalytics', () => {
  it('excludes /admin and below, nothing that merely starts with it', () => {
    expect(wantsAnalytics('/admin')).toBe(false)
    expect(wantsAnalytics('/admin/users/3')).toBe(false)
    expect(wantsAnalytics('/administration')).toBe(true)
    expect(wantsAnalytics('/')).toBe(true)
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
