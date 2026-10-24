import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../shared/store/authStore'
import { jsonResponse, makeUser } from '../test/fixtures'
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

  afterEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState())
  })

  it('shows the placeholder start page in its own brand, without any API call', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Sicher durch die SBF-Theorie' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'SBF Lotse – Startseite' })).toHaveAttribute('href', '/')
    expect(screen.getByText('Anmelden · bald')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Zu SKS Lotse' })).toHaveAttribute('href', 'https://sks-lotse.de')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links SBF Lotse’s own pages and the shared AGB in the footer, without the SKS ones', () => {
    renderAt('/')
    const footer = within(screen.getByRole('contentinfo'))

    expect(footer.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(footer.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
    expect(footer.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/terms')
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

  it('shows the shared Datenschutzerklärung, its AGB link on SBF Lotse itself', () => {
    renderAt('/privacy')

    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung' })).toBeInTheDocument()
    const main = within(screen.getByRole('main'))
    expect(main.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/terms')
  })

  it('shows the AGB both sites share (ADR-0070), without any API call', () => {
    renderAt('/terms')

    expect(screen.getByRole('heading', { level: 1, name: 'AGB' })).toBeInTheDocument()
    expect(screen.getByText(/regeln die Nutzung von SKS Lotse \(sks-lotse.de\) und SBF Lotse/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
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

  describe('with accounts (VITE_SBF_ACCOUNTS=on, ADR-0070)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_SBF', 'on')
      vi.stubEnv('VITE_SBF_ACCOUNTS', 'on')
      fetchMock.mockReset()
    })

    it('offers the login to a guest, after checking the session once', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401))
      renderAt('/')

      expect(await screen.findByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/login')
      expect(screen.queryByText('Anmelden · bald')).not.toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledOnce()
      expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/auth\/me$/)
    })

    it('shows the login with the note on the shared account', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401))
      renderAt('/login')

      expect(await screen.findByLabelText('E-Mail-Adresse')).toBeInTheDocument()
      expect(screen.getByText('Hast du ein Konto bei SKS Lotse, gilt es auch hier.')).toBeInTheDocument()
    })

    it('shows the balance and the Konto menu once signed in, without an admin link', async () => {
      fetchMock.mockResolvedValue(jsonResponse(makeUser({ token_balance: 12, is_admin: true })))
      renderAt('/')

      expect(await screen.findByRole('link', { name: '12 Tokens – zu den Preisen' })).toHaveAttribute(
        'href',
        '/pricing',
      )
      await userEvent.click(screen.getByRole('button', { name: 'Konto' }))
      expect(screen.getByRole('link', { name: 'Kontoeinstellungen' })).toHaveAttribute('href', '/profile/account')
      expect(screen.getByRole('link', { name: 'Tokens kaufen' })).toHaveAttribute('href', '/pricing')
      expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    })

    it('sends a guest from the profile to the login', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not authenticated' }, 401))
      renderAt('/profile')

      expect(await screen.findByLabelText('E-Mail-Adresse')).toBeInTheDocument()
    })

    it('shows the account settings under /profile/account', async () => {
      fetchMock.mockResolvedValue(jsonResponse(makeUser()))
      renderAt('/profile')

      expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Konto' })).toHaveAttribute('href', '/profile/account')
      expect(screen.getByRole('button', { name: 'Konto löschen' })).toBeInTheDocument()
    })

    it('still has no admin area', async () => {
      fetchMock.mockResolvedValue(jsonResponse(makeUser({ is_admin: true })))
      renderAt('/admin')

      expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
    })
  })
})
