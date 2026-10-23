import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GuestCta, LoginLink } from './LoginLink'

function renderAt(element: React.ReactElement) {
  render(
    <MemoryRouter initialEntries={['/learn']}>
      <Routes>
        <Route path="/learn" element={element} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginLink', () => {
  afterEach(() => {
    delete window.umami
  })

  it('counts a sign-up invitation taken up, with where it was', async () => {
    const track = vi.fn()
    window.umami = { track }
    renderAt(<GuestCta place="learn">Mit Konto mehr.</GuestCta>)

    await userEvent.click(screen.getByRole('link', { name: 'Kostenlos anmelden' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(track).toHaveBeenCalledExactlyOnceWith('signup_cta_clicked', { place: 'learn' })
  })

  it('counts nothing without a place (the expired session’s "Anmelden")', async () => {
    const track = vi.fn()
    window.umami = { track }
    renderAt(<LoginLink>Anmelden</LoginLink>)

    await userEvent.click(screen.getByRole('link', { name: 'Anmelden' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(track).not.toHaveBeenCalled()
  })
})
