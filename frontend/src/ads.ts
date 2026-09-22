import { useAuthStore } from './store/authStore'

interface GoogleFundingChoices {
  callbackQueue?: unknown[]
  showRevocationMessage?: () => void
}

declare global {
  interface Window {
    googlefc?: GoogleFundingChoices
  }
}

// Google AdSense (ADR-0027, ADR-0041). The script tag itself is injected into the built
// HTML by the adsense-snippet plugin in vite.config.ts, only when
// VITE_ADSENSE_CLIENT_ID is set (unset locally/in CI) — and only into the prerendered
// public pages: scripts/prerender.mjs strips it from app.html, the shell every logged-in
// route is served. Google's certified TCF CMP is configured in the AdSense dashboard and
// shown by that script, which withholds personalised ads until the visitor has chosen.
export function adsEnabled() {
  return Boolean(import.meta.env.VITE_ADSENSE_CLIENT_ID)
}

// Whether this visitor should see ads: configured, and not an account with ads
// removed (the operator flips users.ads_removed on /admin). Every ad element
// goes through this.
export function useShowAds() {
  const adsRemoved = useAuthStore((state) => state.user?.ads_removed ?? false)
  return adsEnabled() && !adsRemoved
}

const ADSENSE_SCRIPT_SELECTOR = 'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'

// Whether the current document was served with Google's ad script — i.e. it started on a
// prerendered public page. Static per document: the tag is in the served HTML, never added later.
export function adScriptLoaded(doc: Document = document) {
  return doc.querySelector(ADSENSE_SCRIPT_SELECTOR) !== null
}

// The page that re-opens the consent dialog on arrival, for documents without the script.
export const CONSENT_SETTINGS_URL = '/privacy?cookie-einstellungen'

// Re-opens Google's consent dialog so a visitor can change or withdraw their
// choice at any time — withdrawing must be as easy as giving it (Art. 7(3)
// DSGVO). Inside the app shell there is no consent API to call, so it goes to a
// public page that loads it and opens the dialog there.
export function openConsentSettings(
  navigate: (url: string) => void = (url) => window.location.assign(url),
  doc: Document = document,
) {
  const fc = window.googlefc
  if (fc?.callbackQueue && fc.showRevocationMessage) {
    fc.callbackQueue.push(fc.showRevocationMessage)
  } else if (!adScriptLoaded(doc)) {
    navigate(CONSENT_SETTINGS_URL)
  }
}

// Counterpart of the redirect above, run once at startup: on a page that has the script and was
// asked to, queue the dialog. Google's CMP runs queued callbacks once it has loaded, so this works
// before the script has finished loading, too.
export function openConsentSettingsIfRequested(search: string = window.location.search, doc: Document = document) {
  if (!new URLSearchParams(search).has('cookie-einstellungen') || !adScriptLoaded(doc)) return
  const fc = (window.googlefc ??= {})
  fc.callbackQueue ??= []
  fc.callbackQueue.push(() => window.googlefc?.showRevocationMessage?.())
}

const AD_FREE_RELOAD_KEY = 'sks-lotse:ad-free-reload'

// One-shot marker for the reload into the ad-free shell (routes/AdFreeDocument.tsx): set right
// before leaving, read and cleared once when the next document starts. If that document still has
// the script (a misconfigured rewrite), the marker is what stops a reload loop.
export function markAdFreeReload(storage: Storage | undefined = safeSessionStorage()) {
  try {
    storage?.setItem(AD_FREE_RELOAD_KEY, '1')
    return storage !== undefined
  } catch {
    return false
  }
}

export function consumeAdFreeReload(storage: Storage | undefined = safeSessionStorage()) {
  try {
    const marked = storage?.getItem(AD_FREE_RELOAD_KEY) === '1'
    storage?.removeItem(AD_FREE_RELOAD_KEY)
    return marked
  } catch {
    return false
  }
}

function safeSessionStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage
  } catch {
    return undefined
  }
}
