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
