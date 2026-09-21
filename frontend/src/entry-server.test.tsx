import { describe, expect, it } from 'vitest'

import { render } from './entry-server'

describe('entry-server render', () => {
  it('prerenders the logged-out landing page with its heading, copy and internal links', () => {
    const html = render('/')

    expect(html).toContain('Sicher durch die SKS-Theorie')
    expect(html).toContain('Originalfragen üben')
    expect(html).toContain('href="/imprint"')
    expect(html).toContain('href="/privacy"')
    // Logged-out state: the sign-up form, not the "already logged in" link.
    expect(html).not.toContain('Du bist bereits angemeldet')
  })

  it.each([
    ['/faq', 'Häufige Fragen'],
    ['/imprint', 'Angaben gemäß § 5 DDG'],
    ['/privacy', 'Datenschutz'],
  ])('prerenders %s as a public page with its heading', (path, heading) => {
    const html = render(path)

    expect(html).toContain(heading)
    expect(html).not.toContain('Sicher durch die SKS-Theorie')
  })
})
