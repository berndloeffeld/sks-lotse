import { describe, expect, it } from 'vitest'

import html from '../../index.sbf.html?raw'
import { applyMeta, escapeHtml, sitemapXml } from '../shared/publicPages'
import { SBF_ORIGIN, sbfPublicPages } from './publicPages'
import { SBF_HOME_TITLE } from './texts'

describe('SBF public pages', () => {
  const pages = sbfPublicPages()

  it('prerenders the start page, the FAQ and the legal pages, nothing of SKS Lotse', () => {
    expect(pages.map((page) => [page.path, page.file])).toEqual([
      ['/', 'index.html'],
      ['/faq', 'faq.html'],
      ['/imprint', 'imprint.html'],
      ['/privacy', 'privacy.html'],
    ])
  })

  it('puts every canonical on sbf-lotse.de', () => {
    for (const page of pages.slice(1)) {
      expect(page.meta?.canonical).toBe(`https://sbf-lotse.de${page.path}`)
    }
  })

  it('keeps the legal pages, which say what sks-lotse.de says, out of the index and the sitemap', () => {
    const noindex = pages.filter((page) => page.meta?.noindex).map((page) => page.path)
    expect(noindex).toEqual(['/imprint', '/privacy'])

    const sitemap = sitemapXml(pages, SBF_ORIGIN)
    expect(sitemap).toContain('<loc>https://sbf-lotse.de/</loc>')
    expect(sitemap).toContain('<loc>https://sbf-lotse.de/faq</loc>')
    expect(sitemap).not.toContain('imprint')
    expect(sitemap).not.toContain('privacy')
    expect(sitemap).not.toContain('sks-lotse.de')
  })

  it('marks a noindex page as such in its head', () => {
    const privacy = pages.find((page) => page.path === '/privacy')!
    const head = applyMeta(html, privacy.meta!)
    expect(head).toContain('<meta name="robots" content="noindex" />')
    expect(applyMeta(html, pages.find((page) => page.path === '/faq')!.meta!)).not.toContain('noindex')
  })

  it('gives the FAQ page its questions as structured data', () => {
    const faq = pages.find((page) => page.path === '/faq')!
    expect(faq.meta?.jsonLd?.[0]).toMatchObject({ '@type': 'FAQPage' })
  })
})

describe('index.sbf.html', () => {
  it('carries the SBF brand, canonical and home title, and starts the SBF entry', () => {
    expect(html).toContain('<html lang="de" data-site="sbf">')
    expect(html).toContain(`<title>${escapeHtml(SBF_HOME_TITLE)}</title>`)
    expect(html).toContain('<link rel="canonical" href="https://sbf-lotse.de/" />')
    expect(html).toContain('<meta property="og:site_name" content="SBF Lotse" />')
    expect(html).toContain('src="/src/sbf/main.tsx"')
    // SKS Lotse only as the publisher's other site, never as canonical or URL.
    expect(html.match(/sks-lotse\.de/g)).toEqual(['sks-lotse.de'])
    expect(html).toContain('"sameAs": ["https://sks-lotse.de/"]')
  })

  it('has one JSON-LD block, which applyMeta can replace', () => {
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1)
    expect(html).toContain('"@type": "WebSite"')
  })
})
