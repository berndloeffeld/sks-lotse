import { faqAnswerParts } from './faq'

// What both sites' prerenders share (ADR-0025, ADR-0067): a page's head, the sitemap and the FAQ's
// structured data. Each site lists its own pages (src/sks/publicPages.ts, src/sbf/publicPages.ts).

// A prerendered page's title and description (SEO copy, each site's text module).
export interface PageText {
  title: string
  description: string
}

export interface PageMeta {
  title: string
  description: string
  canonical: string
  // Structured data for the page's head (schema.org), one <script type="application/ld+json"> each.
  jsonLd?: Record<string, unknown>[]
  // Reachable, but not for the index nor the sitemap: the SBF site's copies of the legal pages,
  // which say word for word what sks-lotse.de says (ADR-0067).
  noindex?: boolean
}

export interface PublicPage {
  path: string
  file: string
  // "/" carries none: its head is index.html's own.
  meta?: PageMeta
}

// The /faq entries as schema.org questions; an answer's `[text](/path)` links become plain text.
// Each site passes its own entries.
export function faqJsonLd(entries: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(({ question, answer }) => ({
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
// via targeted replacement on the shared shell. The "/"-scoped JSON-LD block (index.html: one block,
// a graph of WebSite, Organization and WebApplication) doesn't fit any of these pages, so it's
// dropped and replaced by the page's own, if any.
export function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)
  const canonical = escapeHtml(meta.canonical)
  const ld = (meta.jsonLd ?? [])
    .map(
      (data) => `    <script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>\n`,
    )
    .join('')
  const robots = meta.noindex ? '    <meta name="robots" content="noindex" />\n' : ''
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
    .replace(/\s*<\/head>/, () => `\n${robots}${ld}  </head>`)
}

// dist/sitemap.xml: every prerendered page that is for the index, on the build's site.
export function sitemapXml(pages: PublicPage[], origin: string): string {
  const urls = pages
    .filter((p) => !p.meta?.noindex)
    .map((p) => `  <url>\n    <loc>${escapeHtml(`${origin}${p.path}`)}</loc>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
