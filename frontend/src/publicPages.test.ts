import { describe, expect, it } from 'vitest'

import type { CatalogExport } from './catalog'
import { EXAM_PROCESS_FAQ, FAQ } from './faq'
import { applyMeta, chartPages, escapeHtml, learnPages, publicPages, sitemapXml } from './publicPages'
import { makeChartExport } from './test/fixtures'

const CATALOG: CatalogExport = {
  topics: [
    { subject: 'navigation', slug: 'seekarten', name: 'Seekarten', display_order: 1 },
    { subject: 'wetterkunde', slug: 'wind', name: 'Wind & "Böen"', display_order: 1 },
  ],
  questions: [
    {
      subject: 'navigation',
      number: 1,
      topic: 'seekarten',
      question_text: 'F',
      answer_text: 'A',
      question_images: [],
      answer_images: [],
    },
    {
      subject: 'navigation',
      number: 2,
      topic: 'seekarten',
      question_text: 'F',
      answer_text: 'A',
      question_images: [],
      answer_images: [],
    },
    {
      subject: 'wetterkunde',
      number: 3,
      topic: 'wind',
      question_text: 'F',
      answer_text: 'A',
      question_images: [],
      answer_images: [],
    },
  ],
}

const SHELL = `<head>
<title>SKS Lotse</title>
<meta name="description" content="Start" />
<link rel="canonical" href="https://sks-lotse.de/" />
<meta property="og:url" content="https://sks-lotse.de/" />
<meta property="og:title" content="SKS Lotse" />
<meta property="og:description" content="Start" />
<meta name="twitter:title" content="SKS Lotse" />
<meta name="twitter:description" content="Start" />
<script type="application/ld+json">{"@type":"WebApplication"}</script>
</head>`

describe('learnPages', () => {
  it('has /learn and one page per topic, all without the static ad script', () => {
    const pages = learnPages(CATALOG)

    expect(pages.map((p) => [p.path, p.file])).toEqual([
      ['/learn', 'learn.html'],
      ['/learn/navigation/seekarten', 'learn/navigation/seekarten.html'],
      ['/learn/wetterkunde/wind', 'learn/wetterkunde/wind.html'],
    ])
    expect(pages.every((p) => p.withoutAds)).toBe(true)
    expect(pages[0].meta?.description).toContain('Alle 3 Fragen')
    expect(pages[1].meta).toMatchObject({
      title: 'Seekarten – SKS-Fragen Navigation – SKS Lotse',
      description:
        'Alle 2 amtlichen SKS-Fragen zum Thema Seekarten (Navigation) mit Musterantwort – kostenlos üben, auch ohne Anmeldung.',
      canonical: 'https://sks-lotse.de/learn/navigation/seekarten',
    })
  })
})

describe('publicPages', () => {
  it('keeps the static pages, the ad script off /pricing only among them', () => {
    const pages = publicPages(CATALOG)
    const statics = pages.slice(0, 7)
    expect(statics.map((p) => p.path)).toEqual([
      '/',
      '/faq',
      '/imprint',
      '/privacy',
      '/terms',
      '/exam-process',
      '/pricing',
    ])
    expect(statics.filter((p) => p.withoutAds).map((p) => p.path)).toEqual(['/pricing'])
    expect(statics[0]).toEqual({ path: '/', file: 'index.html' })
    expect(statics[1].file).toBe('faq.html')
  })
})

describe('chartPages', () => {
  it('has /charts and one page per sheet, all without the static ad script', () => {
    const pages = chartPages(makeChartExport())

    expect(pages.map((p) => [p.path, p.file])).toEqual([
      ['/charts', 'charts.html'],
      ['/charts/1', 'charts/1.html'],
      ['/charts/2', 'charts/2.html'],
    ])
    expect(pages.every((p) => p.withoutAds)).toBe(true)
    expect(pages[1].meta).toMatchObject({
      title: 'Kartenaufgabe 1: Cuxhaven → Büsum – SKS-Navigation – SKS Lotse',
      description:
        'Amtliche SKS-Kartenaufgabe 1, Cuxhaven → Büsum: Elbabwärts durch die Norderrinne. 2 Aufgaben, 3 Punkte, mit amtlicher Lösung und Herleitung – kostenlos üben, auch ohne Anmeldung.',
      canonical: 'https://sks-lotse.de/charts/1',
    })
  })

  it('gives the list its own head', () => {
    expect(chartPages(makeChartExport())[0].meta).toMatchObject({
      title: 'SKS-Kartenaufgaben online üben – SKS Lotse',
      description:
        'Die amtlichen Kartenaufgaben der SKS-Prüfung mit Lösung und Herleitung, Aufgabe für Aufgabe – kostenlos üben, auch ohne Anmeldung.',
      canonical: 'https://sks-lotse.de/charts',
    })
  })

  it('are built only when the Kartenaufgaben are open to guests', () => {
    expect(publicPages(CATALOG).some((p) => p.path.startsWith('/charts'))).toBe(false)
    expect(
      publicPages(CATALOG, makeChartExport())
        .slice(-3)
        .map((p) => p.path),
    ).toEqual(['/charts', '/charts/1', '/charts/2'])
  })
})

describe('every page but "/"', () => {
  it('has a title, a description and its canonical of its own', () => {
    const pages = publicPages(CATALOG, makeChartExport()).slice(1)
    for (const page of pages) {
      expect(page.meta?.title.length, page.path).toBeGreaterThan(10)
      expect(page.meta?.description.length, page.path).toBeGreaterThan(50)
      expect(page.meta?.canonical, page.path).toBe(`https://sks-lotse.de${page.path}`)
    }
    expect(new Set(pages.map((p) => p.meta?.title)).size).toBe(pages.length)
    expect(new Set(pages.map((p) => p.meta?.description)).size).toBe(pages.length)
  })
})

describe('structured data', () => {
  const pages = publicPages(CATALOG, makeChartExport())
  const ld = (path: string) =>
    pages.find((p) => p.path === path)?.meta?.jsonLd?.[0] as {
      '@type': string
      mainEntity: unknown[]
      itemListElement: { item: string }[]
    }

  it('gives /faq a FAQPage with every question and its answer as plain text', () => {
    const faq = ld('/faq')
    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity).toHaveLength(FAQ.length)
    expect(JSON.stringify(faq)).not.toContain('](/')
  })

  it('gives /exam-process a breadcrumb and a FAQPage with the answers the page shows', () => {
    const [crumbs, faq] = pages.find((p) => p.path === '/exam-process')?.meta?.jsonLd as {
      '@type': string
      mainEntity: { name: string; acceptedAnswer: { text: string } }[]
    }[]
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(faq['@type']).toBe('FAQPage')
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
      EXAM_PROCESS_FAQ.map(({ question, answer }) => [question, answer]),
    )
  })

  it('gives the topic and sheet pages a breadcrumb from the start page', () => {
    const topic = ld('/learn/navigation/seekarten')
    expect(topic['@type']).toBe('BreadcrumbList')
    expect(topic.itemListElement.map((i) => i.item)).toEqual([
      'https://sks-lotse.de/',
      'https://sks-lotse.de/learn',
      'https://sks-lotse.de/learn/navigation/seekarten',
    ])
    expect(ld('/charts/1').itemListElement).toHaveLength(3)
    expect(ld('/learn').itemListElement).toHaveLength(2)
    expect(ld('/charts').itemListElement).toHaveLength(2)
  })
})

describe('escapeHtml', () => {
  it('escapes everything that could end an attribute or element', () => {
    expect(escapeHtml(`a & b <c> "d" 'e'`)).toBe('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;')
  })
})

describe('applyMeta', () => {
  it('sets title, description and canonical everywhere, escaped, and drops the JSON-LD', () => {
    const html = applyMeta(SHELL, {
      title: 'Wind & "Böen" $&',
      description: 'Über <Wind>',
      canonical: 'https://sks-lotse.de/learn/wetterkunde/wind',
    })

    expect(html).toContain('<title>Wind &amp; &quot;Böen&quot; $&amp;</title>')
    expect(html).toContain('<meta name="description" content="Über &lt;Wind&gt;" />')
    expect(html).toContain('<link rel="canonical" href="https://sks-lotse.de/learn/wetterkunde/wind" />')
    expect(html).toContain('<meta property="og:url" content="https://sks-lotse.de/learn/wetterkunde/wind" />')
    expect(html).toContain('<meta property="og:title" content="Wind &amp; &quot;Böen&quot; $&amp;" />')
    expect(html).toContain('<meta property="og:description" content="Über &lt;Wind&gt;" />')
    expect(html).toContain('<meta name="twitter:title" content="Wind &amp; &quot;Böen&quot; $&amp;" />')
    expect(html).toContain('<meta name="twitter:description" content="Über &lt;Wind&gt;" />')
    expect(html).not.toContain('ld+json')
    expect(html).not.toContain('content="Start"')
  })

  it('puts the page\'s own JSON-LD into the head, with "<" masked', () => {
    const html = applyMeta(SHELL, {
      title: 'T',
      description: 'D',
      canonical: 'https://sks-lotse.de/x',
      jsonLd: [{ '@type': 'Question', name: '</script><b>' }],
    })

    expect(html).not.toContain('WebApplication')
    expect(html).toContain(
      '<script type="application/ld+json">{"@type":"Question","name":"\\u003c/script>\\u003cb>"}</script>',
    )
    expect(html.indexOf('ld+json')).toBeLessThan(html.indexOf('</head>'))
  })
})

describe('sitemapXml', () => {
  it('lists every page under the site', () => {
    const xml = sitemapXml([
      { path: '/', file: 'index.html' },
      { path: '/learn', file: 'learn.html' },
    ])
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://sks-lotse.de/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://sks-lotse.de/learn</loc>\n  </url>\n</urlset>\n',
    )
  })
})
