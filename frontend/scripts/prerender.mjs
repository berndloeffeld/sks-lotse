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
//   dist/<name>.html  — likewise for /faq, /imprint, /privacy, /terms and
//                       /exam-process; render.yaml rewrites each of those paths to
//                       its file explicitly. Each of these (everything but
//                       "/") also gets its own <title>/description/OG/
//                       Twitter/canonical via applyMeta below, and drops the
//                       "/"-scoped JSON-LD block — see ADR-0025's
//                       2026-09-24 update.
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

// path -> { file, meta? } in dist/. Keep in sync with the public routes in render.yaml.
// "/" carries no `meta`: its head is index.html's own, untouched by applyMeta.
const PAGES = {
  '/': { file: 'index.html' },
  '/faq': {
    file: 'faq.html',
    meta: {
      title: 'Häufige Fragen zur SKS-Theorieprüfung – SKS Lotse',
      description:
        'Antworten rund um den amtlichen SKS-Fragenkatalog, den Lernstand und die Prüfungssimulation der SKS App – für alle, die sich auf die SKS-Theorieprüfung vorbereiten.',
      canonical: 'https://sks-lotse.de/faq',
    },
  },
  '/imprint': {
    file: 'imprint.html',
    meta: {
      title: 'Impressum – SKS Lotse',
      description: 'Impressum und Anbieterkennzeichnung von SKS Lotse, der App zum Lernen für die SKS-Theorieprüfung.',
      canonical: 'https://sks-lotse.de/imprint',
    },
  },
  '/privacy': {
    file: 'privacy.html',
    meta: {
      title: 'Datenschutz – SKS Lotse',
      description:
        'Datenschutzerklärung von SKS Lotse: welche Daten beim Lernen für die SKS-Theorieprüfung verarbeitet werden und wie du sie löschen kannst.',
      canonical: 'https://sks-lotse.de/privacy',
    },
  },
  '/terms': {
    file: 'terms.html',
    meta: {
      title: 'AGB – SKS Lotse',
      description:
        'Allgemeine Geschäftsbedingungen von SKS Lotse, der Online-App für die Vorbereitung auf die SKS-Theorieprüfung.',
      canonical: 'https://sks-lotse.de/terms',
    },
  },
  '/exam-process': {
    file: 'exam-process.html',
    meta: {
      title: 'So läuft die SKS-Prüfung ab – SBF See, Theorie und Praxis',
      description:
        'Der komplette Weg zum Sportküstenschifferschein: vom Bootsführerschein SBF See über die SKS-Theorieprüfung bis zur Praxisprüfung – kompakt erklärt.',
      canonical: 'https://sks-lotse.de/exam-process',
    },
  },
}

// Gives a prerendered page its own title/description/OG/Twitter/canonical instead of
// index.html's, via targeted replacement on the shared shell. The "/"-scoped WebApplication
// JSON-LD block (index.html) doesn't fit any of these pages, so it's dropped rather than
// duplicated per page — a page that later earns its own structured data (e.g. an FAQPage
// schema for /faq) can add one deliberately.
function applyMeta(html, { title, description, canonical }) {
  html = html.replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
    `<meta name="description" content="${description}" />`,
  )
  html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${canonical}" />`,
  )
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${title}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${description}" />`,
  )
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${title}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${description}" />`,
  )
  html = html.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
  return html
}

// The only ad-related tag the build emits (vite.config.ts, adsense-snippet). The public pages keep
// it — AdSense's site verification reads their source. The shell must start without it: once
// loaded it can't be removed again, and ads-removed accounts and /admin must not run it.
const ADSENSE_TAG = /<script\b[^>]*pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*><\/script>\s*/g
const appShell = shell.replace(ADSENSE_TAG, '')
if (appShell.includes('adsbygoogle')) {
  throw new Error('prerender: Google ad script still present in app.html')
}
writeFileSync(`${dist}app.html`, appShell)
for (const [path, { file, meta }] of Object.entries(PAGES)) {
  const root = `<div id="root" data-prerendered="${path}">${render(path)}</div>`
  let html = shell.replace(ROOT, root)
  if (meta) html = applyMeta(html, meta)
  writeFileSync(`${dist}${file}`, html)
}
rmSync(ssrDir, { recursive: true, force: true })

console.log(
  `prerender: wrote ${Object.values(PAGES)
    .map((p) => p.file)
    .join(', ')} and app.html (SPA shell, without the static ad script)`,
)
