interface GoogleFundingChoices {
  callbackQueue?: unknown[]
  showRevocationMessage?: () => void
}

declare global {
  interface Window {
    googlefc?: GoogleFundingChoices
  }
}

// Google AdSense (ADR-0027). The script tag itself is injected into the built
// HTML by the adsense-snippet plugin in vite.config.ts, only when
// VITE_ADSENSE_CLIENT_ID is set (unset locally/in CI). Google's certified TCF
// CMP is configured in the AdSense dashboard and shown by that script, which
// withholds personalised ads until the visitor has chosen.
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
