// Build-time prerender of the public pages (ADR-0025). Runs after the
// client build (dist/) and the SSR build of src/entry-server.tsx (dist-ssr/):
//
//   dist/app.html     — the SPA shell (empty #root), minus Google's ad script
//                       (ADR-0041): render.yaml's SPA fallback rewrites every
//                       unknown path here, which includes /login and every
//                       logged-in route.
//   dist/index.html   — the same shell with "/" rendered into #root, so
//                       crawlers see real text, headings and links.
//   dist/<name>.html  — likewise for /faq, /imprint and /privacy; render.yaml
//                       rewrites each of those paths to its file explicitly.
//
// The rendered root is tagged data-prerendered="<path>" so main.tsx only
// hydrates markup that belongs to the route it is actually showing.
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const ssrDir = fileURLToPath(new URL('../dist-ssr/', import.meta.url))
const ROOT = '<div id="root"></div>'

const { render } = await import(new URL('../dist-ssr/entry-server.js', import.meta.url).href)

const shell = readFileSync(`${dist}index.html`, 'utf8')
if (!shell.includes(ROOT)) {
  throw new Error(`prerender: ${ROOT} not found in dist/index.html`)
}

// path -> file in dist/. Keep in sync with the public routes in render.yaml.
const PAGES = {
  '/': 'index.html',
  '/faq': 'faq.html',
  '/imprint': 'imprint.html',
  '/privacy': 'privacy.html',
}

// The only ad-related tag the build emits (vite.config.ts, adsense-snippet). The public pages keep
// it — AdSense's site verification reads their source — the logged-in app never loads it.
const ADSENSE_TAG = /<script\b[^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>\s*/g
const appShell = shell.replace(ADSENSE_TAG, '')
if (appShell.includes('adsbygoogle')) {
  throw new Error('prerender: Google ad script still present in app.html')
}
writeFileSync(`${dist}app.html`, appShell)
for (const [path, file] of Object.entries(PAGES)) {
  const root = `<div id="root" data-prerendered="${path}">${render(path)}</div>`
  writeFileSync(`${dist}${file}`, shell.replace(ROOT, root))
}
rmSync(ssrDir, { recursive: true, force: true })

console.log(`prerender: wrote ${Object.values(PAGES).join(', ')} and app.html (SPA shell, no ad script)`)
