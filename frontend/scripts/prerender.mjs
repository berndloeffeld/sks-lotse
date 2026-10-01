// Build-time prerender of the public pages (ADR-0025). Runs after the
// client build (dist/) and the SSR build of src/entry-server.tsx (dist-ssr/):
//
//   dist/app.html     — the SPA shell (empty #root), minus the static ad
//                       script: render.yaml's SPA fallback rewrites every
//                       unknown path here, which includes /login and every
//                       logged-in route, and those load the script at runtime
//                       only where wanted (src/routes/AdScriptGate.tsx,
//                       ADR-0027 addendum 2026-09-23).
//   dist/index.html   — the same shell with "/" rendered into #root, so
//                       crawlers see real text, headings and links.
//   dist/<path>/index.html — likewise for every page in src/publicPages.ts:
//                       /faq, /imprint, /privacy, /terms, /exam-process,
//                       /pricing, and the open /learn pages (ADR-0054), e.g.
//                       dist/learn/navigation/seekarten/index.html. Render
//                       serves a directory's index.html for its path, so
//                       render.yaml needs no rewrite per page (ADR-0055).
//                       Each of these (everything but "/") also gets its own
//                       <title>/description/OG/Twitter/canonical via applyMeta,
//                       and drops the "/"-scoped JSON-LD block — see ADR-0025's
//                       2026-09-24 update. /pricing and the /learn pages are
//                       built without the static ad script (like app.html).
//
//   dist/sitemap.xml  — every one of those pages.
//
// The rendered root is tagged data-prerendered="<path>" so main.tsx only
// hydrates markup that belongs to the route it is actually showing.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const ssrDir = fileURLToPath(new URL('../dist-ssr/', import.meta.url))
const ROOT = '<div id="root"></div>'

// The pages, their heads and the sitemap come from src/publicPages.ts, via the SSR build.
const { render, pages, applyMeta, sitemapXml } = await import(
  new URL('../dist-ssr/entry-server.js', import.meta.url).href
)

const shell = readFileSync(`${dist}index.html`, 'utf8')
if (!shell.includes(ROOT)) {
  throw new Error(`prerender: ${ROOT} not found in dist/index.html`)
}

// The only ad-related tag the build emits (vite.config.ts, adsense-snippet). The public pages keep
// it — AdSense's site verification reads their source. The shell must start without it: once
// loaded it can't be removed again, and ads-removed accounts and /admin must not run it.
const ADSENSE_TAG = /<script\b[^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>\s*/g
function withoutAdScript(html, file) {
  html = html.replace(ADSENSE_TAG, '')
  if (html.includes('adsbygoogle')) {
    throw new Error(`prerender: Google ad script still present in ${file}`)
  }
  return html
}

writeFileSync(`${dist}app.html`, withoutAdScript(shell, 'app.html'))
for (const { path, file, meta, withoutAds } of pages) {
  const root = `<div id="root" data-prerendered="${path}">${render(path)}</div>`
  let html = shell.replace(ROOT, () => root)
  if (meta) html = applyMeta(html, meta)
  if (withoutAds) html = withoutAdScript(html, file)
  mkdirSync(dirname(`${dist}${file}`), { recursive: true })
  writeFileSync(`${dist}${file}`, html)
}
writeFileSync(`${dist}sitemap.xml`, sitemapXml(pages))
rmSync(ssrDir, { recursive: true, force: true })

const withAds = pages.filter((p) => !p.withoutAds).map((p) => p.file)
console.log(
  `prerender: wrote ${pages.length} pages and app.html (SPA shell), sitemap.xml; with the static ad script only: ${withAds.join(', ')}`,
)
