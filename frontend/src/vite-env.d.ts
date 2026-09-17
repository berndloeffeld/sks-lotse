/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Absolute origin the API is reachable at in local dev (e.g.
  // http://localhost:8000). Left unset in production, where the frontend is
  // served same-site with the API (ADR-0012) and relative paths resolve
  // correctly on their own.
  readonly VITE_API_BASE_URL?: string

  // Umami Cloud website id (see ADR-0016). Left unset in local dev/CI so
  // src/analytics.ts skips loading the tracking script there — only set in
  // production (Render dashboard, sync: false in render.yaml).
  readonly VITE_UMAMI_WEBSITE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
