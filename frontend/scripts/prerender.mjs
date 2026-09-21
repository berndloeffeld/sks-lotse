// Build-time prerender of the public pages (ADR-0025). Runs after the
// client build (dist/) and the SSR build of src/entry-server.tsx (dist-ssr/):
//
//   dist/app.html     — the untouched SPA shell (empty #root). render.yaml's
//                       SPA fallback rewrites every unknown path here.
//   dist/index.html   — the same shell with "/" rendered into #root, so
//                       crawlers see real text, headings and links.
//   dist/<name>.html  — likewise for /faq, /imprint and /privacy; render.yaml
//                       rewrites each of those paths to its file explicitly.
//
// The rendered root is tagged data-prerendered="<path>" so main.tsx only
// hydrates markup that belongs to the route it is actually showing.
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

copyFileSync(`${dist}index.html`, `${dist}app.html`)
for (const [path, file] of Object.entries(PAGES)) {
  const root = `<div id="root" data-prerendered="${path}">${render(path)}</div>`
  writeFileSync(`${dist}${file}`, shell.replace(ROOT, root))
}
rmSync(ssrDir, { recursive: true, force: true })

console.log(`prerender: wrote ${Object.values(PAGES).join(', ')} and app.html (SPA shell)`)
