# 0021. Self-host web fonts instead of loading them from Google Fonts

Status: Accepted

## Context

[ADR-0014](0014-visual-design-system.md) picked `Fraunces`, `Public Sans` and `IBM Plex Mono` and loaded all three from the Google Fonts CDN (`<link>` to `fonts.googleapis.com` in `frontend/index.html`). That means every page view makes the visitor's browser contact Google's servers, handing Google the visitor's IP address — before any interaction, without consent, and without a mention in the Datenschutzerklärung.

For a German site that's a known legal risk, not a theoretical one: LG München I (judgment of 20 January 2022, Az. 3 O 17493/20) held that embedding Google Fonts this way transfers personal data (the IP address) to Google without a legal basis and awarded damages, which set off a wave of Abmahnungen against German sites. It also contradicts the position this project took for analytics in [ADR-0016](0016-umami-cloud-analytics-without-consent-banner.md): no consent banner, because nothing on the site needs one.

Options considered:
1. **Self-host via the `@fontsource/*` npm packages** — the same OFL-licensed font files, published per family/weight/style as CSS + woff2; imported in `main.tsx`, bundled and fingerprinted by Vite, served from our own origin. Versioned in `package.json`, so Dependabot keeps them current.
2. **Download the woff2 files by hand into `frontend/public/`** plus a hand-written `@font-face` block — same privacy result, but manual to update and easy to get subsets/`unicode-range` wrong.
3. **Keep Google Fonts and add consent** — rejected: a consent banner just for typography, and the page would render in fallback fonts until consent.
4. **System font stack only** — rejected: drops the deliberate typography ADR-0014 decided on.

## Decision

**Option 1.** `frontend/src/main.tsx` imports only the weights/styles the design system uses (`Fraunces` 400/400-italic/600, `Public Sans` 400/500/600, `IBM Plex Mono` 400/500); the Google Fonts `<link>`/`preconnect` tags are removed from `index.html`. The `@font-face` family names are the same as before, so the `--font-*` tokens in `index.css` don't change. The fonts are now served from the site's own origin.

## Consequences

- No third-party request on page load for typography — nothing to disclose or consent to for fonts.
- The production build ships the font files itself (every Unicode subset per weight, woff2 plus a woff fallback — ~800 KB in `dist/assets/`); browsers still only download the woff2 subsets a page actually uses (`unicode-range`), so real page weight is unchanged.
- New weights or styles need an extra `import` in `main.tsx` — a style added in CSS alone will silently fall back to a synthesized face.
- ADR-0014's sentence "All three load from Google Fonts" is amended by this ADR.
