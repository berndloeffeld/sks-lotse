import { act } from '@testing-library/react'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { appRoutes } from './appRoutes'
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

  it('prerenders /pricing logged out, with the prices still loading', () => {
    const html = render('/pricing')

    expect(html).toContain('Preise')
    expect(html).toContain('Lädt …')
    expect(html).not.toContain('Shop')
    expect(html).not.toContain('role="status"')
  })

  // The client hydrates the prerendered markup under its own data router (main.tsx, ADR-0059). Both
  // must render the same tree, or React's ids (useId) and markup no longer match.
  it.each(['/', '/learn', '/learn/navigation/seekarten', '/charts/1', '/exam-process'])(
    'hydrates %s under the client’s router without a mismatch',
    async (path) => {
      // The session check stays open, as it is during the client's first render.
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => {})),
      )
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onRecoverableError = vi.fn()
      const container = document.createElement('div')
      container.innerHTML = render(path)
      document.body.append(container)

      const root = await act(async () =>
        hydrateRoot(
          container,
          <StrictMode>
            <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />
          </StrictMode>,
          { onRecoverableError },
        ),
      )

      expect(onRecoverableError).not.toHaveBeenCalled()
      expect(consoleError).not.toHaveBeenCalled()
      act(() => root.unmount())
      container.remove()
      consoleError.mockRestore()
    },
  )
})
