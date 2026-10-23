# 0067. A second site from the same codebase: the site's identity per build

Status: Accepted — amends [ADR-0015](0015-frontend-deployment-topology.md) (a second static site, for sbf-lotse.de) and [ADR-0025](0025-build-time-prerender-of-the-landing-page.md) (the prerender renders the build's site)

## Context

SKS Lotse is to cover the Sportbootführerschein (SBF) See and Binnen as well, in six increments. The SBF is a separate licence with its own learners, its own search terms and its own official catalog. It gets its own brand, "SBF Lotse", under its own domain, sbf-lotse.de. The first increment is the 15 official Navigationsaufgaben See, open to guests. Accounts, saving, the Lotsen-Check and buying come later.

The SKS identity was hard-coded across the frontend:
- `index.html`: title, canonical, Open Graph, JSON-LD, theme color.
- `publicPages.ts`, `prerender.mjs`, `public/`.
- The header, footer, page title suffix, contact subject and share texts.

Every page also checked the session against the API on load.

The SBF site must:
- not share content with sks-lotse.de (SEO: no duplicate content);
- carry none of the SKS app (no `/admin`, no login yet);
- make no API call at all while it has no accounts.

Options considered:
1. **A runtime switch on the hostname.** One build serves both domains and picks the brand in the browser. But the prerendered HTML, canonicals and sitemap would have to be one site's or the other's. The SKS app and its session check would ship to sbf-lotse.de, and a wrong hostname check would show the wrong brand.
2. **A second repository or a fork of the frontend.** Clean separation, but every shared fix lands twice. The point of the increments is to grow SBF Lotse out of the same code.
3. **One codebase, the site chosen per build.** A build-time variable picks the site. Each build is a complete, prerendered site of its own, deployed as its own Render static site.

## Decision

**Option 3: `VITE_SITE=sks|sbf`, validated in `vite.config.ts`.** Unset means `sks`, so every existing setup keeps building SKS Lotse, and an unknown value fails the build (`src/site.ts`, like the Kartenaufgaben flag, [ADR-0056](0056-chart-exercises-open-to-guests.md)).

- **The page and entry per site.** `index.html` stays the SKS page. For `sbf`, a small Vite plugin swaps in `index.sbf.html`, which has the SBF head and starts `src/sbf/main.tsx`. Vite builds both pages alike. The SSR entry for the prerender is chosen the same way (`src/sbf/entry-server.tsx`). `scripts/prerender.mjs` takes the app shell's title and the data chunks to preload from the entry, so it knows no site.
- **Public files per site.** `publicDir` is `public/` or `public-sbf/`, each with its own favicons, manifest, `robots.txt`, `og-image.png` and `security.txt`. The SKS images (catalog, Kartenaufgaben, screenshots) stay off sbf-lotse.de.
- **Shared parts read the site; session parts stay SKS-only.**
  - Logo, header bar, page shell and footer read the site's identity (`siteIdentity()`: name, origin, footer links, source line).
  - Header and `PageLayout` (session, account nav) are split from `HeaderBar` and `PageShell`, the same for the error boundary.
  - Impressum and Datenschutzerklärung become shared content components (`src/legal/`).
  - The SBF routes (`src/sbf/SbfApp.tsx`) use only the shared parts. The SBF bundle has no auth store, no API client and no SKS data chunk. `scripts/check-sbf-build.mjs` checks this in CI after an SBF build, a step in the existing `frontend-lint` job, so the required checks stay as they are.
- **No API call from SBF Lotse.** Its CSP has no API host, and the build sets no `VITE_API_BASE_URL`.
- **The content behind its own flag.** `VITE_SBF=off|on` is allowed only in the SBF build. At `off` the build has only a placeholder start page, the FAQ and the legal pages, and no task content. `render.yaml` sets `off` until the usage rights are confirmed; opening it is a PR of its own.
- **SEO, each site on its own.**
  - Canonicals, sitemap and structured data use the build's origin.
  - The SBF site's Impressum and Datenschutzerklärung say word for word what sks-lotse.de says. They are `noindex` and left out of its sitemap.
  - SBF Lotse links to SKS Lotse as the next step. SKS Lotse links back once SBF Lotse has content.
- **Theme "Fahrwasserblau"**: the same token roles as SKS Lotse with blue values, set on `:root[data-site='sbf']` in `index.css`. The mark is SKS Lotse's chart tile, with the blue position fix. There is no dark mode.
- **No admin and no account on SBF Lotse.** Admin stays on sks-lotse.de. The AGB stay SKS Lotse's and come to SBF Lotse with accounts (increment 2). One Impressum and one Datenschutzerklärung cover both brands, and the latter names both domains and their separate Umami websites.
- **Deployment.** A second Render static site, `sbf-lotse-frontend`, from the same `frontend/`, with its own env (`VITE_SITE=sbf`, `VITE_SBF`, its own `VITE_UMAMI_WEBSITE_ID`), rewrites and headers. The custom domains are owner steps, as for SKS Lotse (RUNBOOK → One-time setup SBF, part 1).

## Consequences

- One change to a shared part reaches both sites. A change to a shared part has to keep the SBF build free of the API: the CI check catches an import that pulls the auth store or a data chunk in.
- Two builds from one tree: `npm run build` builds SKS Lotse, `VITE_SITE=sbf npm run build` builds SBF Lotse. CI builds both. Tests run as SKS Lotse unless they stub `VITE_SITE`.
- `render.yaml` has two static sites. The backend tests that read it now read it per service (`tests/render_blueprint.py`).
- When SBF Lotse gets accounts, the API call is cross-site: sbf-lotse.de is not same-site with api.sks-lotse.de, unlike sks-lotse.de ([ADR-0015](0015-frontend-deployment-topology.md), [ADR-0012](0012-httponly-cookie-for-frontend-session-token.md)). The `SameSite=Lax` session cookie would not be sent. Increment 2 needs its own decision: an API under sbf-lotse.de, or a different cookie setup.
- The single uvicorn worker is not affected now, since guests on sbf-lotse.de cause static load only. Its capacity for the later load is assessed in docs/NON-FUNCTIONAL-REQUIREMENTS.md.
- Rejected:
  - A runtime switch on the hostname (option 1): one prerender for two sites, and the SKS app on sbf-lotse.de.
  - A fork (option 2): every shared fix twice.

## Update 2026-10-23: one Umami website for both sites

Umami Cloud's free plan has room for one website only, and that one is SKS Lotse's. Instead of a paid plan, `sbf-lotse-frontend` gets the same `VITE_UMAMI_WEBSITE_ID` as `sks-lotse-frontend`. This replaces "their separate Umami websites" and "its own `VITE_UMAMI_WEBSITE_ID`" in the Decision above.

- Umami records the hostname of every page view, so its reports tell sks-lotse.de and sbf-lotse.de apart by a filter.
- The Datenschutzerklärung says the two are evaluated together, by domain.
- Both sites share the free plan's 100,000 events a month. A site of its own would need the Pro plan and a change of that sentence again.

