// Build-time prerender of the public landing page (ADR-0025). Runs after the
// client build (dist/) and the SSR build of src/entry-server.tsx (dist-ssr/):
//
//   dist/app.html   — the untouched SPA shell (empty #root). render.yaml's
//                     SPA fallback rewrites every unknown path here.
//   dist/index.html — the same shell with "/" rendered into #root, so
//                     crawlers see real text, headings and links.
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

copyFileSync(`${dist}index.html`, `${dist}app.html`)
writeFileSync(`${dist}index.html`, shell.replace(ROOT, `<div id="root">${render('/')}</div>`))
rmSync(ssrDir, { recursive: true, force: true })

console.log('prerender: wrote dist/index.html (/) and dist/app.html (SPA shell)')
