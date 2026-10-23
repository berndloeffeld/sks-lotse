import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sbfRoutes } from './routes'

function renderAt(path: string) {
  return render(<RouterProvider router={createMemoryRouter(sbfRoutes, { initialEntries: [path] })} />)
}

describe('SBF site', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_SITE', 'sbf')
    vi.stubGlobal('fetch', fetchMock)
  })

  it('shows the placeholder start page in its own brand, without any API call', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Sicher durch die SBF-Theorie' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SBF Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Anmelden · bald')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zu SKS Lotse' })).toHaveAttribute('href', 'https://sks-lotse.de')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links SBF Lotse’s own pages in the footer, without the SKS ones and the AGB', () => {
    renderAt('/')
    const footer = within(screen.getByRole('contentinfo'))

    expect(footer.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
    expect(footer.queryByRole('link', { name: 'AGB' })).not.toBeInTheDocument()
    expect(footer.queryByRole('link', { name: 'Prüfungsablauf' })).not.toBeInTheDocument()
    expect(footer.getByRole('link', { name: 'Kontakt' })).toHaveAttribute(
      'href',
      'mailto:kontakt@sks-lotse.de?subject=Feedback%20SBF%20Lotse',
    )
    expect(footer.getByText(`© ${new Date().getFullYear()} SBF Lotse`)).toBeInTheDocument()
    // No official content yet, so no source line either.
    expect(footer.queryByText(/ELWIS/)).not.toBeInTheDocument()
  })

  it('answers the FAQ', () => {
    renderAt('/faq')

    expect(screen.getByRole('heading', { level: 1, name: 'Häufige Fragen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Was ist die Navigationsaufgabe im SBF See?' })).toBeInTheDocument()
    expect(document.title).toBe('Häufige Fragen – SBF Lotse')
  })

  it('shows the shared Impressum', () => {
    renderAt('/imprint')

    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Angaben gemäß § 5 DDG' })).toBeInTheDocument()
  })

  it('shows the shared Datenschutzerklärung, its AGB link on SKS Lotse', () => {
    renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', 'https://sks-lotse.de/terms')
  })

  it('has no SKS routes: /learn, /admin and /login lead nowhere', () => {
    for (const path of ['/learn', '/admin', '/login']) {
      const { unmount } = renderAt(path)
      expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Zur Startseite' })).toHaveAttribute('href', '/')
      unmount()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
