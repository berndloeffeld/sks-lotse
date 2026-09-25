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

// Google AdSense (ADR-0027). The public pages carry the script as a static tag,
// injected into the built HTML by the adsense-snippet plugin in vite.config.ts
// (AdSense's site verification reads their source). The app shell (app.html) is
// built without it — scripts/prerender.mjs strips the tag — and loads it at
// runtime instead, only where wantsAdScript says so (ADR-0027 addendum
// 2026-09-23): not for accounts that removed ads, never on the admin tools.
// All of it only when VITE_ADSENSE_CLIENT_ID is set (unset locally/in CI).
// Google's certified TCF CMP is configured in the AdSense dashboard and shown
// by that script, which withholds personalised ads until the visitor has chosen.
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

// Whether a page of the app should run Google's script. Not on the admin tools: the script runs
// as same-origin JavaScript, and an operator session there can export and delete accounts.
export function wantsAdScript(showAds: boolean, pathname: string) {
  return showAds && !/^\/admin(\/|$)/.test(pathname)
}

const ADSENSE_SCRIPT_SELECTOR = 'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'

// Whether the current document has Google's ad script — a static tag (a public page) or one
// injectAdScript added.
export function adScriptLoaded(doc: Document = document) {
  return doc.querySelector(ADSENSE_SCRIPT_SELECTOR) !== null
}

// Same tag the adsense-snippet plugin in vite.config.ts writes into the public pages.
export function injectAdScript(clientId: string, doc: Document = document) {
  if (adScriptLoaded(doc)) return
  const script = doc.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
  script.crossOrigin = 'anonymous'
  doc.head.append(script)
}

// The page that re-opens the consent dialog on arrival, for documents without the script — at
// the privacy policy's ad section, so it still says what's going on if the dialog doesn't come up.
export const CONSENT_SETTINGS_URL = '/privacy?cookie-einstellungen#werbung'

// How long a click waits for Google's consent dialog before saying it can't be shown.
export const CONSENT_DIALOG_TIMEOUT_MS = 2000

// Queues a callback for Google's CMP: it runs them once it has loaded (and right away after that),
// so this works while the script is still loading, too.
function queueForConsentApi(callback: () => void) {
  const fc = (window.googlefc ??= {})
  fc.callbackQueue ??= []
  fc.callbackQueue.push(callback)
}

// Google's CMP adds an iframe named googlefcInactive when it has nothing to show on this page
// load (no message for the visitor's location, or none published in AdSense). It still defines
// showRevocationMessage then, which just does nothing.
function consentDialogInactive(doc: Document) {
  return doc.querySelector('iframe[name="googlefcInactive"]') !== null
}

// Re-opens Google's consent dialog so a visitor can change or withdraw their
// choice at any time — withdrawing must be as easy as giving it (Art. 7(3)
// DSGVO). Where this document has no consent API (the admin tools), it goes to
// a public page that loads it and opens the dialog there. Where the script is
// here but Google's CMP never comes up (an ad blocker or a network filter drops
// it) or reports itself inactive (no message to show), `onUnavailable` runs after
// CONSENT_DIALOG_TIMEOUT_MS so the click never silently does nothing.
export function openConsentSettings(
  onUnavailable: () => void = () => {},
  navigate: (url: string) => void = (url) => window.location.assign(url),
  doc: Document = document,
) {
  if (!adScriptLoaded(doc)) {
    navigate(CONSENT_SETTINGS_URL)
    return
  }
  let shown = false
  queueForConsentApi(() => {
    const show = window.googlefc?.showRevocationMessage
    if (!show) return
    shown = true
    show()
  })
  setTimeout(() => {
    if (!shown || consentDialogInactive(doc)) onUnavailable()
  }, CONSENT_DIALOG_TIMEOUT_MS)
}

// Counterpart of the redirect above, run once at startup: on a page that has the script and was
// asked to, queue the dialog.
export function openConsentSettingsIfRequested(search: string = window.location.search, doc: Document = document) {
  if (!new URLSearchParams(search).has('cookie-einstellungen') || !adScriptLoaded(doc)) return
  queueForConsentApi(() => window.googlefc?.showRevocationMessage?.())
}

const AD_FREE_RELOAD_KEY = 'sks-lotse:ad-free-reload'

// One-shot marker for leaving a document that has the script but mustn't (routes/AdScriptGate.tsx):
// set right before the reload, read and cleared once when the next document starts. If that
// document still has the script (a misconfigured rewrite), the marker is what stops a reload loop.
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
