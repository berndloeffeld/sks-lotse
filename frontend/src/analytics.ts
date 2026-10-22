const UMAMI_SCRIPT_SRC = 'https://cloud.umami.is/script.js'

// Not on the admin tools: third-party JavaScript runs with the page's rights, and an operator
// session there can export and delete accounts.
// Nor where the login link lands (/login/link, ADR-0064): its token sits in the URL's fragment
// until the page clears it, and a pageview recorded before that must not carry it off.
// /pricing keeps it on purpose: that is where the purchase funnel is measured, the payment itself
// happens on Stripe's page, and Umami sets no cookie and sees no form content.
export function wantsAnalytics(pathname: string) {
  return !/^\/admin(\/|$)/.test(pathname) && pathname !== '/login/link'
}

const UMAMI_SCRIPT_SELECTOR = 'script[data-website-id]'

// Whether this document runs the Umami script (it can't be unloaded again).
export function analyticsLoaded(doc: Document = document) {
  return doc.querySelector(UMAMI_SCRIPT_SELECTOR) !== null
}

// Cookieless analytics (Umami Cloud, see ADR-0016) — no consent banner
// needed. Gated on the env var being set at all, which doubles as the
// dev/prod switch: unset locally (frontend/.env.example), set in production
// (render.yaml), so local/test traffic never gets tracked.
export function initAnalytics(pathname: string = window.location.pathname) {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
  if (!websiteId || !wantsAnalytics(pathname)) return

  const script = document.createElement('script')
  script.defer = true
  script.src = UMAMI_SCRIPT_SRC
  script.dataset.websiteId = websiteId
  document.head.appendChild(script)
}

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, string | number>) => void }
  }
}

// Custom Umami events for the core funnel (login → learning → simulation →
// focus). Names and properties are fixed, coarse keys — never free text, ids
// of the learner or answers — so cookieless analytics stays free of personal
// data (ADR-0016). A no-op wherever the script isn't loaded (local dev, CI,
// blocked by an ad blocker); analytics must never break the app. A guest's action, which the
// backend never sees (ADR-0054/0056), has its own event prefixed `guest_`, so the learners' events
// keep counting learners only and Umami shows both side by side.
export function trackEvent(name: string, data?: Record<string, string | number>) {
  try {
    window.umami?.track(name, data)
  } catch {
    // ignore
  }
}
