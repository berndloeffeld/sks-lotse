import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

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
    })

    it('is hidden while ads are not configured', () => {
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
