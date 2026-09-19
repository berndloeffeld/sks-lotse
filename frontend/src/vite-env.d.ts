/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Absolute origin of the API: http://localhost:8000 in local dev
  // (.env.example), https://api.sks-lotse.de in production (render.yaml,
  // ADR-0015) — a different origin from the frontend in both cases. Unset
  // falls back to relative paths, i.e. an API served from the same origin.
  readonly VITE_API_BASE_URL?: string

  // Umami Cloud website id (see ADR-0016). Left unset in local dev/CI so
  // src/analytics.ts skips loading the tracking script there — only set in
  // production (Render dashboard, sync: false in render.yaml).
  readonly VITE_UMAMI_WEBSITE_ID?: string

  // Google AdSense publisher id (ca-pub-…, see ADR-0027). Unset in local dev/CI
  // so src/ads.ts skips loading the ad script — only set in production.
  readonly VITE_ADSENSE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
