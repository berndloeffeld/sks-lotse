import { faqJsonLd, type PublicPage } from '../publicPages'
import { SITES } from '../site'
import { SBF_FAQ } from './faq'
import { SBF_FAQ_TEXT, SBF_IMPRINT_TEXT, SBF_PRIVACY_TEXT } from './texts'
import type { PageText } from '../publicPageTexts'

// The SBF site's prerendered pages (ADR-0025, ADR-0067), on sbf-lotse.de: scripts/prerender.mjs
// renders each, the sitemap lists those for the index, and render.yaml's sbf-lotse-frontend
// rewrites each path to its file. Imprint and privacy say word for word what sks-lotse.de says, so
// they are reachable but kept out of the index (noindex, not in the sitemap).

export const SBF_ORIGIN = SITES.sbf.origin

function page(
  path: string,
  { title, description }: PageText,
  extra: { noindex?: boolean; jsonLd?: Record<string, unknown>[] } = {},
): PublicPage {
  return {
    path,
    file: `${path.slice(1)}.html`,
    meta: { title, description, canonical: `${SBF_ORIGIN}${path}`, ...extra },
  }
}

export function sbfPublicPages(): PublicPage[] {
  return [
    { path: '/', file: 'index.html' },
    page('/faq', SBF_FAQ_TEXT, { jsonLd: [faqJsonLd(SBF_FAQ)] }),
    page('/imprint', SBF_IMPRINT_TEXT, { noindex: true }),
    page('/privacy', SBF_PRIVACY_TEXT, { noindex: true }),
  ]
}
