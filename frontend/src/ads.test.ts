import { afterEach, describe, expect, it, vi } from 'vitest'

import { adsEnabled, openConsentSettings } from './ads'

describe('ads', () => {
  afterEach(() => {
    delete window.googlefc
    vi.unstubAllEnvs()
  })

  it('is off without a publisher id and on with one', () => {
    expect(adsEnabled()).toBe(false)

    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')

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
