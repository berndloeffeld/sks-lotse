import { describe, expect, it, vi } from 'vitest'

import { appTitle, dataChunks, pages, render, sitemapXml } from './entry-server'

describe('SBF entry-server', () => {
  it('prerenders the placeholder start page', () => {
    vi.stubEnv('VITE_SITE', 'sbf')
    const html = render('/')
    expect(html).toContain('Sicher durch die SBF-Theorie')
    expect(html).toContain('SBF Lotse')
    expect(html).not.toContain('SKS-Theorie')
  })

  it('hands the prerender the SBF pages, title and sitemap', () => {
    expect(pages.map((page) => page.path)).toEqual(['/', '/faq', '/imprint', '/privacy'])
    expect(appTitle).toBe('SBF Lotse')
    expect(dataChunks).toEqual([])
    expect(sitemapXml(pages)).toContain('<loc>https://sbf-lotse.de/faq</loc>')
  })
})
