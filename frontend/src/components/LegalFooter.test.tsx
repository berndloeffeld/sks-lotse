import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { CONSENT_DIALOG_TIMEOUT_MS } from '../ads'
import { useAuthStore } from '../store/authStore'
import { LegalFooter } from './LegalFooter'
import { makeUser } from '../test/fixtures'

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

  it('leaves the content links (FAQ, Ablauf, Preise) to the header', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'FAQ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ablauf' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Preise' })).not.toBeInTheDocument()
  })

  it('offers a contact mail link', () => {
    render(
      <MemoryRouter>
        <LegalFooter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute(
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

  describe('Cookies', () => {
    afterEach(() => {
      delete window.googlefc
      document.head.querySelector('script[data-test-adsense]')?.remove()
      useAuthStore.setState({ user: null, isAuthenticated: false })
      vi.useRealTimers()
    })

    // The document has Google's script (as the public pages do), so a click waits for its CMP.
    function addAdScript() {
      const script = document.createElement('script')
      script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-123'
      script.dataset.testAdsense = ''
      document.head.append(script)
    }

    it('is hidden while ads are not configured', () => {
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      expect(screen.queryByRole('button', { name: 'Cookies' })).not.toBeInTheDocument()
    })

    it('is hidden for an account with ads removed', () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
      useAuthStore.setState({
        user: makeUser({ ads_removed: true }),
        isAuthenticated: true,
        isLoading: false,
      })
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      expect(screen.queryByRole('button', { name: 'Cookies' })).not.toBeInTheDocument()
    })

    it('re-opens the consent dialog when ads are configured', async () => {
      vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
      addAdScript()
      const showRevocationMessage = vi.fn()
      window.googlefc = { callbackQueue: [], showRevocationMessage }
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Cookies' }))
      for (const callback of window.googlefc.callbackQueue as Array<() => void>) callback()

      expect(showRevocationMessage).toHaveBeenCalledOnce()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('says so when Google’s dialog can’t be loaded, and clears that on the next try', () => {
      vi.useFakeTimers()
      vi.stubEnv('VITE_ADSENSE_CLIENT_ID', 'ca-pub-123')
      addAdScript()
      render(
        <MemoryRouter>
          <LegalFooter />
        </MemoryRouter>,
      )

      // fireEvent, not user-event: user-event schedules its own timers, which fake timers stall.
      fireEvent.click(screen.getByRole('button', { name: 'Cookies' }))
      act(() => vi.advanceTimersByTime(CONSENT_DIALOG_TIMEOUT_MS))

      expect(screen.getByRole('status')).toHaveTextContent(/Einstellungsdialog lässt sich gerade nicht laden/)
      expect(screen.getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/privacy#werbung')

      fireEvent.click(screen.getByRole('button', { name: 'Cookies' }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})
