import { describe, expect, it } from 'vitest'

import type { CatalogExport } from './catalog'
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
      ['/learn', 'learn/index.html'],
      ['/learn/navigation/seekarten', 'learn/navigation/seekarten/index.html'],
      ['/learn/wetterkunde/wind', 'learn/wetterkunde/wind/index.html'],
    ])
    expect(pages.every((p) => p.withoutAds)).toBe(true)
    expect(pages[0].meta?.description).toContain('Alle 3 Fragen')
    expect(pages[1].meta).toEqual({
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
    expect(statics[1].file).toBe('faq/index.html')
  })
})

describe('chartPages', () => {
  it('has /charts and one page per sheet, all without the static ad script', () => {
    const pages = chartPages(makeChartExport())

    expect(pages.map((p) => [p.path, p.file])).toEqual([
      ['/charts', 'charts/index.html'],
      ['/charts/1', 'charts/1/index.html'],
      ['/charts/2', 'charts/2/index.html'],
    ])
    expect(pages.every((p) => p.withoutAds)).toBe(true)
    expect(pages[1].meta).toEqual({
      title: 'Kartenaufgabe 1 – SKS-Navigation – SKS Lotse',
      description:
        'Amtliche SKS-Kartenaufgabe 1: 2 Aufgaben, 3 Punkte, mit amtlicher Lösung und Herleitung – kostenlos üben, auch ohne Anmeldung.',
      canonical: 'https://sks-lotse.de/charts/1',
    })
  })

  it('gives the list its own head', () => {
    expect(chartPages(makeChartExport())[0].meta).toEqual({
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
})

describe('sitemapXml', () => {
  it('lists every page under the site', () => {
    const xml = sitemapXml([
      { path: '/', file: 'index.html' },
      { path: '/learn', file: 'learn/index.html' },
    ])
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://sks-lotse.de/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://sks-lotse.de/learn</loc>\n  </url>\n</urlset>\n',
    )
  })
})
