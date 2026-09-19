const ADSENSE_SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

interface GoogleFundingChoices {
  callbackQueue?: unknown[]
  showRevocationMessage?: () => void
}

declare global {
  interface Window {
    googlefc?: GoogleFundingChoices
  }
}

// Google AdSense (ADR-0027). Gated on the publisher id being set, like
// analytics.ts: unset locally/in CI so dev traffic never reaches Google.
// The consent message itself (Google's certified TCF CMP) is configured in
// the AdSense dashboard and shown by this very script, which withholds
// personalised ads until the visitor has chosen.
export function initAds() {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID
  if (!clientId) return

  const script = document.createElement('script')
  script.async = true
  script.src = `${ADSENSE_SCRIPT_SRC}?client=${encodeURIComponent(clientId)}`
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

export function adsEnabled() {
  return Boolean(import.meta.env.VITE_ADSENSE_CLIENT_ID)
}

// Re-opens Google's consent dialog so a visitor can change or withdraw their
// choice at any time — withdrawing must be as easy as giving it (Art. 7(3)
// DSGVO).
export function openConsentSettings() {
  const fc = window.googlefc
  if (fc?.callbackQueue && fc.showRevocationMessage) {
    fc.callbackQueue.push(fc.showRevocationMessage)
  }
}
