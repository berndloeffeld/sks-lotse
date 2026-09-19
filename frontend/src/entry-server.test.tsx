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
})
