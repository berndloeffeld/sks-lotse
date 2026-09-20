const UMAMI_SCRIPT_SRC = 'https://cloud.umami.is/script.js'

// Cookieless analytics (Umami Cloud, see ADR-0016) — no consent banner
// needed. Gated on the env var being set at all, which doubles as the
// dev/prod switch: unset locally (frontend/.env.example), set in production
// (render.yaml), so local/test traffic never gets tracked.
export function initAnalytics() {
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
  if (!websiteId) return

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
// blocked by an ad blocker); analytics must never break the app.
export function trackEvent(name: string, data?: Record<string, string | number>) {
  try {
    window.umami?.track(name, data)
  } catch {
    // ignore
  }
}
