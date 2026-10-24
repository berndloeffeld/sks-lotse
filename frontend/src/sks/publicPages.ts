import type { CatalogExport } from './catalog'
import { sheetMaxPoints, type ChartExport } from './chartCatalog'
import { EXAM_PROCESS_FAQ, FAQ, LEARNING_METHOD_FAQ } from './faq'
import { SUBJECT_LABELS } from './labels'
import {
  CHARTS_CRUMB,
  CHARTS_INDEX_TEXT,
  EXAM_PROCESS_CRUMB,
  EXAM_PROCESS_TEXT,
  FAQ_TEXT,
  IMPRINT_TEXT,
  LEARN_CRUMB,
  LEARNING_METHOD_CRUMB,
  LEARNING_METHOD_TEXT,
  PRICING_TEXT,
  PRIVACY_TEXT,
  ROOT_CRUMB,
  TERMS_TEXT,
  learnIndexText,
  sheetCrumb,
  shortTopicTitle,
  sheetText,
  topicText,
} from './publicPageTexts'
import { faqJsonLd, type PageText, type PublicPage } from '../shared/publicPages'
import { SITES } from '../shared/site'

// The prerendered pages (ADR-0025): scripts/prerender.mjs renders each into dist/<file>, the
// sitemap lists them, and render.yaml rewrites each path to its file (for the /learn pages,
// backend/tests/test_catalog_export.py checks that every one is there). The open /learn pages come from the catalog export (ADR-0054).

export const SITE = SITES.sks.origin

function page(path: string, { title, description }: PageText, jsonLd?: Record<string, unknown>[]): PublicPage {
  return {
    path,
    file: `${path.slice(1)}.html`,
    meta: { title, description, canonical: `${SITE}${path}`, ...(jsonLd ? { jsonLd } : {}) },
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

// A page's short answers as schema.org questions (the same text the page shows).
function shortAnswersJsonLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
}

const STATIC_PAGES: PublicPage[] = [
  { path: '/', file: 'index.html' },
  page('/faq', FAQ_TEXT, [faqJsonLd(FAQ)]),
  page('/imprint', IMPRINT_TEXT),
  page('/privacy', PRIVACY_TEXT),
  page('/terms', TERMS_TEXT),
  page('/exam-process', EXAM_PROCESS_TEXT, [
    breadcrumbs([ROOT_CRUMB, '/'], [EXAM_PROCESS_CRUMB, '/exam-process']),
    shortAnswersJsonLd(EXAM_PROCESS_FAQ),
  ]),
  page('/learning-method', LEARNING_METHOD_TEXT, [
    breadcrumbs([ROOT_CRUMB, '/'], [LEARNING_METHOD_CRUMB, '/learning-method']),
    shortAnswersJsonLd(LEARNING_METHOD_FAQ),
  ]),
  page('/pricing', PRICING_TEXT),
]

// About as many characters as a search result shows of a title. A topic name is transcribed from the
// catalog and can't be shortened, so a long one gets the shorter title instead.
const TITLE_MAX_CHARS = 60

function topicPageText(name: string, subject: string, count: number): PageText {
  const text = topicText(name, subject, count)
  return text.title.length <= TITLE_MAX_CHARS ? text : { ...text, title: shortTopicTitle(name) }
}

// /learn and one page per topic.
export function learnPages(catalog: CatalogExport): PublicPage[] {
  return [
    page('/learn', learnIndexText(catalog.questions.length), [breadcrumbs([ROOT_CRUMB, '/'], [LEARN_CRUMB, '/learn'])]),
    ...catalog.topics.map((topic) => {
      const subject = SUBJECT_LABELS[topic.subject] ?? topic.subject
      const count = catalog.questions.filter((q) => q.subject === topic.subject && q.topic === topic.slug).length
      const path = `/learn/${topic.subject}/${topic.slug}`
      return page(path, topicPageText(topic.name, subject, count), [
        breadcrumbs([ROOT_CRUMB, '/'], [LEARN_CRUMB, '/learn'], [topic.name, path]),
      ])
    }),
  ]
}

// /charts and one page per transcribed sheet, open to guests while the build's flag is "on"
// (ADR-0056).
export function chartPages(charts: ChartExport): PublicPage[] {
  return [
    page('/charts', CHARTS_INDEX_TEXT, [breadcrumbs([ROOT_CRUMB, '/'], [CHARTS_CRUMB, '/charts'])]),
    ...charts.sheets.map((sheet) => {
      const path = `/charts/${sheet.number}`
      return page(path, sheetText(sheet, sheetMaxPoints(sheet)), [
        breadcrumbs([ROOT_CRUMB, '/'], [CHARTS_CRUMB, '/charts'], [sheetCrumb(sheet.number), path]),
      ])
    }),
  ]
}

// `charts` only while the Kartenaufgaben are open to guests; otherwise their pages aren't built.
export function publicPages(catalog: CatalogExport, charts: ChartExport | null = null): PublicPage[] {
  return [...STATIC_PAGES, ...learnPages(catalog), ...(charts ? chartPages(charts) : [])]
}
