# 0025. Build-time prerender of the landing page

Status: Accepted

## Context

The frontend is a client-rendered SPA ([ADR-0013](0013-frontend-architecture-and-tooling.md)) served by a Render static site ([ADR-0015](0015-frontend-deployment-topology.md)). Every route got the same `index.html` with an empty `<div id="root">`, and the content only appeared once JavaScript ran.

An on-page SEO check of `https://sks-lotse.de/` showed what that means for crawlers that don't execute JavaScript, and for link previews: word count 0, no `<h1>`, no headings, almost no internal links, and a title whose words never appear in the text. Googlebot does render JavaScript, but later and less reliably. Other crawlers and preview bots mostly don't. The only page that has to rank is the public landing page. Everything else is behind login or is a legal page.

Options considered:

1. **Full SSR** (a Node server that renders every request). This needs a runtime, but the frontend is deliberately a static site with no server.
2. **A prerender framework or plugin** (e.g. vite-plugin-ssr/Vike, react-snap with headless Chrome). This adds a large dependency or a headless browser in CI for one page.
3. **A small build-time prerender** using React's own `renderToString`. The landing page is rendered once during `npm run build` and the HTML is written into `dist/index.html`.

## Decision

Option 3.

- `src/entry-server.tsx` renders the same route tree as the app (`AppRoutes`, split out of `App`) under a `StaticRouter`.
- `npm run build` does the client build, then a `vite build --ssr` of that entry, then runs `scripts/prerender.mjs`. The script keeps the untouched shell as `dist/app.html` and writes `/` rendered into `#root` as `dist/index.html`.
- `render.yaml`'s SPA fallback rewrites to `/app.html`, not `/index.html`. Deep links like `/start` never flash the landing page's markup. Render only rewrites paths with no matching file, so `/` still gets the prerendered `index.html`.
- `main.tsx` calls `hydrateRoot` when `#root` already has markup and the path is `/`. Otherwise it clears the container and uses `createRoot` as before.
- The prerender shows the logged-out state. The client's first render starts in that same state (`authStore.isAuthenticated` is `false` until `checkSession` resolves), so hydration matches. A logged-in visitor sees the logged-out landing page for a moment before the session check flips it, which is the same as before.

## Consequences

- Crawlers and link previews get the real heading, text and links of `/` without any runtime or new dependency.
- Only `/` was prerendered at first (see the update below for the other public pages).
- Anything rendered on the landing page must now be SSR-safe: no `window`/`document` access during render, and no values that differ between build and first client render. A mismatch doesn't break the page. React logs it and client-renders from scratch, losing the benefit. One known case is the footer's `new Date().getFullYear()`, which mismatches from New Year until the next deploy.
- Two builds per `npm run build`, a few hundred ms longer.
- `vite dev` is unaffected: there is no prerendered markup, so it always takes the `createRoot` path. `npm run preview` serves the prerendered `index.html` for every route, and the path check in `main.tsx` handles that.

## Update 2026-09-21: `/faq`, `/imprint` and `/privacy` prerendered too

The FAQ is public content that should be findable, and the legal pages are public too, so `scripts/prerender.mjs` now writes `faq.html`, `imprint.html` and `privacy.html` next to `index.html`. Whether Render maps `/faq` to a file on its own stayed unverified, so `render.yaml` rewrites each of the three paths to its file explicitly, ahead of the `/app.html` fallback. The list of pages exists twice (`PAGES` in the script and the rewrites); adding a public page means touching both.

Each prerendered root carries `data-prerendered="<path>"`, and `main.tsx` hydrates only when that equals the current path (trailing slash ignored). That replaces the old `pathname === '/'` check and keeps the `vite preview` case working: it serves `index.html` for every route, and the mismatch makes the client render from scratch.
