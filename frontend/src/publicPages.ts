import type { CatalogExport } from './catalog'
import { sheetMaxPoints, type ChartExport } from './chartCatalog'
import { EXAM_PROCESS_FAQ, FAQ, faqAnswerParts } from './faq'
import { SUBJECT_LABELS } from './labels'
import {
  CHARTS_CRUMB,
  CHARTS_INDEX_TEXT,
  EXAM_PROCESS_CRUMB,
  EXAM_PROCESS_TEXT,
  FAQ_TEXT,
  IMPRINT_TEXT,
  LEARN_CRUMB,
  PRICING_TEXT,
  PRIVACY_TEXT,
  ROOT_CRUMB,
  TERMS_TEXT,
  learnIndexText,
  sheetCrumb,
  sheetText,
  topicText,
  type PageText,
} from './publicPageTexts'

// The prerendered pages (ADR-0025): scripts/prerender.mjs renders each into dist/<file>, the
// sitemap lists them, and render.yaml rewrites each path to its file (for the /learn pages,
// backend/tests/test_catalog_export.py checks that every one is there). The open /learn pages come from the catalog export (ADR-0054).

export const SITE = 'https://sks-lotse.de'

export interface PageMeta {
  title: string
  description: string
  canonical: string
  // Structured data for the page's head (schema.org), one <script type="application/ld+json"> each.
  jsonLd?: Record<string, unknown>[]
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

function page(
  path: string,
  { title, description }: PageText,
  withoutAds = false,
  jsonLd?: Record<string, unknown>[],
): PublicPage {
  return {
    path,
    file: `${path.slice(1)}.html`,
    meta: { title, description, canonical: `${SITE}${path}`, ...(jsonLd ? { jsonLd } : {}) },
    ...(withoutAds ? { withoutAds } : {}),
  }
}

// A trail from the start page: [name, path] per level, the last one being the page itself.
function breadcrumbs(...trail: [string, string][]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${SITE}${path}`,
    })),
  }
}

// The /faq entries as schema.org questions; an answer's `[text](/path)` links become plain text.
function faqJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerParts(answer)
          .map((part) => part.text)
          .join(''),
      },
    })),
  }
}

// /exam-process: its short answers as schema.org questions (the same text the page shows).
function examProcessJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: EXAM_PROCESS_FAQ.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

const STATIC_PAGES: PublicPage[] = [
  { path: '/', file: 'index.html' },
  page('/faq', FAQ_TEXT, false, [faqJsonLd()]),
  page('/imprint', IMPRINT_TEXT),
  page('/privacy', PRIVACY_TEXT),
  page('/terms', TERMS_TEXT),
  page('/exam-process', EXAM_PROCESS_TEXT, false, [
    breadcrumbs([ROOT_CRUMB, '/'], [EXAM_PROCESS_CRUMB, '/exam-process']),
    examProcessJsonLd(),
  ]),
  // No Google script on /pricing, where the purchase starts, not even during it.
  page('/pricing', PRICING_TEXT, true),
]

// /learn and one page per topic. Logged-in learners land on these too, including ads-removed
// accounts, so they are built without the static ad script.
export function learnPages(catalog: CatalogExport): PublicPage[] {
  return [
    page('/learn', learnIndexText(catalog.questions.length), true, [
      breadcrumbs([ROOT_CRUMB, '/'], [LEARN_CRUMB, '/learn']),
    ]),
    ...catalog.topics.map((topic) => {
      const subject = SUBJECT_LABELS[topic.subject] ?? topic.subject
      const count = catalog.questions.filter((q) => q.subject === topic.subject && q.topic === topic.slug).length
      const path = `/learn/${topic.subject}/${topic.slug}`
      return page(path, topicText(topic.name, subject, count), true, [
        breadcrumbs([ROOT_CRUMB, '/'], [LEARN_CRUMB, '/learn'], [topic.name, path]),
      ])
    }),
  ]
}

// /charts and one page per transcribed sheet, open to guests while the build's flag is "on"
// (ADR-0056). Logged-in learners land on them too, so they are built without the ad script as well.
export function chartPages(charts: ChartExport): PublicPage[] {
  return [
    page('/charts', CHARTS_INDEX_TEXT, true, [breadcrumbs([ROOT_CRUMB, '/'], [CHARTS_CRUMB, '/charts'])]),
    ...charts.sheets.map((sheet) => {
      const path = `/charts/${sheet.number}`
      return page(path, sheetText(sheet, sheetMaxPoints(sheet)), true, [
        breadcrumbs([ROOT_CRUMB, '/'], [CHARTS_CRUMB, '/charts'], [sheetCrumb(sheet.number), path]),
      ])
    }),
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
// (index.html) doesn't fit any of these pages, so it's dropped and replaced by the page's own, if any.
export function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const canonical = escapeHtml(meta.canonical)
  const ld = (meta.jsonLd ?? [])
    .map(
      (data) => `    <script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>\n`,
    )
    .join('')
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
    .replace(/\s*<\/head>/, () => `\n${ld}  </head>`)
}

// dist/sitemap.xml: every prerendered page.
export function sitemapXml(pages: PublicPage[]): string {
  const urls = pages.map((p) => `  <url>\n    <loc>${escapeHtml(`${SITE}${p.path}`)}</loc>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
