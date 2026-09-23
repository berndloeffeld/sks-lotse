import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adScriptLoaded,
  adsEnabled,
  consumeAdFreeReload,
  CONSENT_SETTINGS_URL,
  injectAdScript,
  markAdFreeReload,
  openConsentSettings,
  openConsentSettingsIfRequested,
  wantsAdScript,
} from './ads'

const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123'

function documentWithScript(src: string | null) {
  const doc = document.implementation.createHTMLDocument()
  if (src) {
    const script = doc.createElement('script')
    script.src = src
    doc.head.append(script)
  }
  return doc
}

describe('ads', () => {
  afterEach(() => {
    delete window.googlefc
    window.sessionStorage.clear()
    vi.unstubAllEnvs()
  })

  it('is off without a publisher id and on with one', () => {
    expect(adsEnabled()).toBe(false)

    vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')

    expect(adsEnabled()).toBe(true)
  })

  it('wants the script wherever ads are shown, except on the admin tools', () => {
    expect(wantsAdScript(true, '/start')).toBe(true)
    expect(wantsAdScript(true, '/login')).toBe(true)
    expect(wantsAdScript(true, '/administration-guide')).toBe(true)
    expect(wantsAdScript(true, '/admin')).toBe(false)
    expect(wantsAdScript(true, '/admin/settings')).toBe(false)
    expect(wantsAdScript(false, '/start')).toBe(false)
  })

  it('injects the same tag the build writes into the public pages, once', () => {
    const doc = documentWithScript(null)

    injectAdScript('ca-pub-1&2', doc)
    injectAdScript('ca-pub-1&2', doc)

    const scripts = doc.head.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1%262')
    expect(scripts[0].async).toBe(true)
    expect(scripts[0].crossOrigin).toBe('anonymous')
    expect(adScriptLoaded(doc)).toBe(true)
  })

  it('does not inject a second tag next to a static one', () => {
    const doc = documentWithScript(ADSENSE_SRC)

    injectAdScript('ca-pub-123', doc)

    expect(doc.head.querySelectorAll('script')).toHaveLength(1)
  })

  it('detects Google’s ad script by its source, not by any script', () => {
    expect(adScriptLoaded(documentWithScript(ADSENSE_SRC))).toBe(true)
    expect(adScriptLoaded(documentWithScript('https://cloud.umami.is/script.js'))).toBe(false)
    expect(adScriptLoaded(documentWithScript(null))).toBe(false)
    expect(adScriptLoaded()).toBe(false)
  })

  it('queues the revocation message once Google’s consent API is present', () => {
    const showRevocationMessage = vi.fn()
    const navigate = vi.fn()
    window.googlefc = { callbackQueue: [], showRevocationMessage }

    openConsentSettings(navigate)

    expect(window.googlefc.callbackQueue).toEqual([showRevocationMessage])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('goes to a public page that can open the dialog when this document has no consent API', () => {
    const navigate = vi.fn()

    openConsentSettings(navigate, documentWithScript(null))

    expect(navigate).toHaveBeenCalledExactlyOnceWith(CONSENT_SETTINGS_URL)
  })

  it('waits for the consent API instead of navigating when the script is still loading', () => {
    const navigate = vi.fn()

    openConsentSettings(navigate, documentWithScript(ADSENSE_SRC))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('opens the dialog on arrival once the consent API is ready', () => {
    openConsentSettingsIfRequested('?cookie-einstellungen', documentWithScript(ADSENSE_SRC))

    const showRevocationMessage = vi.fn()
    window.googlefc!.showRevocationMessage = showRevocationMessage
    const [queued] = window.googlefc!.callbackQueue as Array<() => void>
    queued()

    expect(showRevocationMessage).toHaveBeenCalledOnce()
    expect(CONSENT_SETTINGS_URL).toBe('/privacy?cookie-einstellungen')
  })

  it('keeps an existing consent queue when asked to open the dialog', () => {
    const earlier = vi.fn()
    window.googlefc = { callbackQueue: [earlier] }

    openConsentSettingsIfRequested('?cookie-einstellungen', documentWithScript(ADSENSE_SRC))

    expect(window.googlefc.callbackQueue).toHaveLength(2)
    expect(window.googlefc.callbackQueue![0]).toBe(earlier)
  })

  it('does not queue the dialog unless asked, or without the script', () => {
    openConsentSettingsIfRequested('', documentWithScript(ADSENSE_SRC))
    openConsentSettingsIfRequested('?cookie-einstellungen', documentWithScript(null))
    openConsentSettingsIfRequested()

    expect(window.googlefc).toBeUndefined()
  })

  it('remembers one reload into the ad-free shell and forgets it once read', () => {
    expect(consumeAdFreeReload()).toBe(false)

    expect(markAdFreeReload()).toBe(true)

    expect(consumeAdFreeReload()).toBe(true)
    expect(consumeAdFreeReload()).toBe(false)
  })

  it('refuses to reload when the marker cannot be stored, so a reload can never loop', () => {
    const broken = {
      setItem: () => {
        throw new Error('quota')
      },
      getItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    } as unknown as Storage

    expect(markAdFreeReload(broken)).toBe(false)
    expect(consumeAdFreeReload(broken)).toBe(false)
  })
})
