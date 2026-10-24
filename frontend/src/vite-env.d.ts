/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Absolute origin of the API: http://localhost:8000 in local dev
  // (.env.example), https://api.sks-lotse.de in production (render.yaml,
  // ADR-0015) — a different origin from the frontend in both cases. Unset
  // falls back to relative paths, i.e. an API served from the same origin.
  readonly VITE_API_BASE_URL?: string

  // Umami Cloud website id (see ADR-0016). Left unset in local dev/CI so
  // src/shared/analytics.ts skips loading the tracking script there — only set in
  // production (Render dashboard, sync: false in render.yaml).
  readonly VITE_UMAMI_WEBSITE_ID?: string

  // The Kartenaufgaben flag for the build: off | admins | on (src/sks/chartFlag.ts, ADR-0056). At "on"
  // guests get /charts without a login, prerendered. render.yaml sets it like the API's CHART_EXERCISES.
  readonly VITE_CHART_EXERCISES?: string

  // Which site the build is: sks | sbf (src/shared/site.ts, ADR-0067), unset = sks. vite.config.ts picks
  // the page (index.html or index.sbf.html), the public files and the prerender by it.
  readonly VITE_SITE?: string

  // The SBF Navigationsaufgaben for guests: off | on (src/shared/sbfFlag.ts), unset = off; only with
  // VITE_SITE=sbf, where "off" builds just the placeholder start page.
  readonly VITE_SBF?: string

  // Accounts on SBF Lotse: off | on (src/shared/sbfFlag.ts), unset = off; only with VITE_SITE=sbf and
  // VITE_SBF=on (ADR-0070).
  readonly VITE_SBF_ACCOUNTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
