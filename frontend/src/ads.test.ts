import { afterEach, describe, expect, it, vi } from 'vitest'

import { adsEnabled, initAds, openConsentSettings } from './ads'

function adsScript() {
  return document.head.querySelector<HTMLScriptElement>('script[src*="adsbygoogle"]')
}

describe('initAds', () => {
  afterEach(() => {
    adsScript()?.remove()
    delete window.googlefc
    vi.unstubAllEnvs()
  })

  it('does nothing when no publisher id is configured', () => {
    initAds()

    expect(adsScript()).toBeNull()
    expect(adsEnabled()).toBe(false)
  })

  it('injects the AdSense script when a publisher id is configured', () => {
    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')

    initAds()

    expect(adsScript()?.src).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123')
    expect(adsScript()?.async).toBe(true)
    expect(adsEnabled()).toBe(true)
  })

  it('queues the revocation message once Google’s consent API is present', () => {
    const showRevocationMessage = vi.fn()
    window.googlefc = { callbackQueue: [], showRevocationMessage }

    openConsentSettings()

    expect(window.googlefc.callbackQueue).toEqual([showRevocationMessage])
  })

  it('is a no-op while the consent API has not loaded', () => {
    expect(() => openConsentSettings()).not.toThrow()
  })
})
