import type { CatalogExport } from './catalog'
import { sheetMaxPoints, type ChartExport } from './chartCatalog'
import { SUBJECT_LABELS } from './labels'

// The prerendered pages (ADR-0025): scripts/prerender.mjs renders each into dist/<file> and the
// sitemap lists them. The open /learn pages come from the catalog export (ADR-0054). Each file is
// its path's directory index (/faq -> faq/index.html), which Render serves without a rewrite in
// render.yaml: a rewrite would go live before the deploy that creates its file (ADR-0055).

export const SITE = 'https://sks-lotse.de'

export interface PageMeta {
  title: string
  description: string
  canonical: string
}

export interface PublicPage {
  path: string
  file: string
  // "/" carries none: its head is index.html's own.
  meta?: PageMeta
  // Built without the static ad script (like the app shell), for pages whose visitors may be
  // logged-in accounts that removed ads; AdScriptGate loads it at runtime where wanted.
  withoutAds?: boolean
}

function page(path: string, title: string, description: string, withoutAds = false): PublicPage {
  return {
    path,
    file: `${path.slice(1)}/index.html`,
    meta: { title, description, canonical: `${SITE}${path}` },
    ...(withoutAds ? { withoutAds } : {}),
  }
}

const STATIC_PAGES: PublicPage[] = [
  { path: '/', file: 'index.html' },
  page(
    '/faq',
    'Häufige Fragen zur SKS-Theorieprüfung – SKS Lotse',
    'Antworten rund um den amtlichen SKS-Fragenkatalog, den Lernstand und die Probeprüfung der SKS App – für alle, die sich auf die SKS-Theorieprüfung vorbereiten.',
  ),
  page(
    '/imprint',
    'Impressum – SKS Lotse',
    'Impressum und Anbieterkennzeichnung von SKS Lotse, der App zum Lernen für die SKS-Theorieprüfung.',
  ),
  page(
    '/privacy',
    'Datenschutz – SKS Lotse',
    'Datenschutzerklärung von SKS Lotse: welche Daten beim Lernen für die SKS-Theorieprüfung verarbeitet werden und wie du sie löschen kannst.',
  ),
  page(
    '/terms',
    'AGB – SKS Lotse',
    'Allgemeine Geschäftsbedingungen von SKS Lotse, der Online-App für die Vorbereitung auf die SKS-Theorieprüfung.',
  ),
  page(
    '/exam-process',
    'So läuft die SKS-Prüfung ab – SBF See, Theorie und Praxis',
    'Der komplette Weg zum Sportküstenschifferschein: vom Bootsführerschein SBF See über die SKS-Theorieprüfung bis zur Praxisprüfung – kompakt erklärt.',
  ),
  // No Google script on /pricing, where the purchase starts, not even during it.
  page(
    '/pricing',
    'Preise – SKS Lotse',
    'Was SKS Lotse kostet: Fragen üben, Musterantwort und Lernfortschritt bleiben kostenlos, Tokens für den Lotsen-Check gibt es in Paketen ohne Abo.',
    true,
  ),
]

// /learn and one page per topic. Logged-in learners land on these too, including ads-removed
// accounts, so they are built without the static ad script.
export function learnPages(catalog: CatalogExport): PublicPage[] {
  const total = catalog.questions.length
  return [
    page(
      '/learn',
      'SKS-Fragenkatalog online lernen – alle Themen – SKS Lotse',
      `Alle ${total} Fragen des amtlichen SKS-Fragenkatalogs nach Themen: Navigation, Schifffahrtsrecht, Wetterkunde und Seemannschaft – kostenlos üben, auch ohne Anmeldung.`,
      true,
    ),
    ...catalog.topics.map((topic) => {
      const subject = SUBJECT_LABELS[topic.subject] ?? topic.subject
      const count = catalog.questions.filter((q) => q.subject === topic.subject && q.topic === topic.slug).length
      return page(
        `/learn/${topic.subject}/${topic.slug}`,
        `${topic.name} – SKS-Fragen ${subject} – SKS Lotse`,
        `Alle ${count} amtlichen SKS-Fragen zum Thema ${topic.name} (${subject}) mit Musterantwort – kostenlos üben, auch ohne Anmeldung.`,
        true,
      )
    }),
  ]
}

// /charts and one page per transcribed sheet, open to guests while the build's flag is "on"
// (ADR-0056). Logged-in learners land on them too, so they are built without the ad script as well.
export function chartPages(charts: ChartExport): PublicPage[] {
  return [
    page(
      '/charts',
      'SKS-Kartenaufgaben online üben – SKS Lotse',
      `Die amtlichen Kartenaufgaben der SKS-Prüfung mit Lösung und Herleitung, Aufgabe für Aufgabe – kostenlos üben, auch ohne Anmeldung.`,
      true,
    ),
    ...charts.sheets.map((sheet) =>
      page(
        `/charts/${sheet.number}`,
        `Kartenaufgabe ${sheet.number} – SKS-Navigation – SKS Lotse`,
        `Amtliche SKS-Kartenaufgabe ${sheet.number}: ${sheet.tasks.length} Aufgaben, ${sheetMaxPoints(sheet)} Punkte, mit amtlicher Lösung und Herleitung – kostenlos üben, auch ohne Anmeldung.`,
        true,
      ),
    ),
  ]
}

// `charts` only while the Kartenaufgaben are open to guests; otherwise their pages aren't built.
export function publicPages(catalog: CatalogExport, charts: ChartExport | null = null): PublicPage[] {
  return [...STATIC_PAGES, ...learnPages(catalog), ...(charts ? chartPages(charts) : [])]
}

// For text placed into the shell's head: topic names come from data, so nothing in them may close
// the attribute or element they sit in.
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Gives a prerendered page its own title/description/OG/Twitter/canonical instead of index.html's,
// via targeted replacement on the shared shell. The "/"-scoped WebApplication JSON-LD block
// (index.html) doesn't fit any of these pages, so it's dropped rather than duplicated per page.
export function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const canonical = escapeHtml(meta.canonical)
  // Replacement functions, so a "$" in the text is never read as a replacement pattern.
  return html
    .replace(/<title>.*?<\/title>/s, () => `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      () => `<meta name="description" content="${description}" />`,
    )
    .replace(/<link rel="canonical" href="[^"]*" \/>/, () => `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, () => `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, () => `<meta property="og:title" content="${title}" />`)
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      () => `<meta property="og:description" content="${description}" />`,
    )
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, () => `<meta name="twitter:title" content="${title}" />`)
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
      () => `<meta name="twitter:description" content="${description}" />`,
    )
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
}

// dist/sitemap.xml: every prerendered page.
export function sitemapXml(pages: PublicPage[]): string {
  const urls = pages.map((p) => `  <url>\n    <loc>${escapeHtml(`${SITE}${p.path}`)}</loc>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
