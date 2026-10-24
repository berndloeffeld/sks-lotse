import { describe, expect, it } from 'vitest'

import { applyMeta, escapeHtml, sitemapXml } from './publicPages'

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

describe('applyMeta on a shell written differently', () => {
  it('finds the tags across line breaks and extra spaces, and swaps the JSON-LD exactly', () => {
    const shell =
      '<head>\n<title>SKS Lotse</title>\n<meta  name="description"\n  content="Start"/>\n' +
      '<link rel="canonical" href="https://sks-lotse.de/" />\n' +
      '<meta property="og:url" content="https://sks-lotse.de/" />\n' +
      '<meta property="og:title" content="SKS Lotse" />\n' +
      '<meta\nproperty="og:description"  content="Start"/>\n' +
      '<meta name="twitter:title" content="SKS Lotse" />\n' +
      '<meta  name="twitter:description"\ncontent="Start"/>' +
      '<script type="application/ld+json">\n{"@type": "WebApplication"}\n</script></head>'

    const html = applyMeta(shell, {
      title: 'T',
      description: 'D',
      canonical: 'https://sks-lotse.de/x',
      jsonLd: [{ a: 1 }, { b: 2 }],
    })

    expect(html).toBe(
      '<head>\n<title>T</title>\n<meta name="description" content="D" />\n' +
        '<link rel="canonical" href="https://sks-lotse.de/x" />\n' +
        '<meta property="og:url" content="https://sks-lotse.de/x" />\n' +
        '<meta property="og:title" content="T" />\n' +
        '<meta property="og:description" content="D" />\n' +
        '<meta name="twitter:title" content="T" />\n' +
        '<meta name="twitter:description" content="D" />\n' +
        '    <script type="application/ld+json">{"a":1}</script>\n' +
        '    <script type="application/ld+json">{"b":2}</script>\n' +
        '  </head>',
    )
  })
})

describe('sitemapXml', () => {
  it('lists every page under the site', () => {
    const xml = sitemapXml(
      [
        { path: '/', file: 'index.html' },
        { path: '/learn', file: 'learn.html' },
      ],
      'https://sks-lotse.de',
    )
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://sks-lotse.de/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://sks-lotse.de/learn</loc>\n  </url>\n</urlset>\n',
    )
  })
})
