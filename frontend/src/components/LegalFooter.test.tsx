import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LegalFooter } from './LegalFooter'

describe('LegalFooter', () => {
  it('links to the Impressum and Datenschutz pages', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/imprint')
    expect(screen.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'AGB' })).toHaveAttribute('href', '/agb')
  })

  it('offers a feedback mail link', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
      'href',
      'mailto:kontakt@sks-lotse.de?subject=Feedback%20SKS%20Lotse',
    )
  })

  it('attributes the question catalog to the WSV via ELWIS', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Wasserstraßen- und Schifffahrtsverwaltung des Bundes/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ELWIS' })).toHaveAttribute('href', 'https://www.elwis.de')
  })

  describe('Cookie-Einstellungen', () => {
    afterEach(() => {
      delete window.googlefc
      vi.unstubAllEnvs()
      useAuthStore.setState({ user: null, isAuthenticated: false })
    })

    it('is hidden while ads are not configured', () => {
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      expect(screen.queryByRole('button', { name: 'Cookie-Einstellungen' })).not.toBeInTheDocument()
    })

    it('is hidden for an account with ads removed', () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
      useAuthStore.setState({
        user: {
          id: 1,
          email: 'a@example.com',
          created_at: '2026-01-01T00:00:00Z',
          exam_variant: null,
          first_name: null,
          last_name: null,
          gender: null,
          is_admin: false,
          ai_grading_enabled: false,
          ads_removed: true,
          ai_checks_remaining: 20,
          agb_accepted_version: null,
        },
        isAuthenticated: true,
        isLoading: false,
      })
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      expect(screen.queryByRole('button', { name: 'Cookie-Einstellungen' })).not.toBeInTheDocument()
    })

    it('re-opens the consent dialog when ads are configured', async () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
      const showRevocationMessage = vi.fn()
      window.googlefc = { callbackQueue: [], showRevocationMessage }
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Cookie-Einstellungen' }))

      expect(window.googlefc.callbackQueue).toEqual([showRevocationMessage])
    })
  })
})
