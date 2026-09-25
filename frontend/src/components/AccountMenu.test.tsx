import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountMenu } from './AccountMenu'
import { makeUser } from '../test/fixtures'

const originalLogout = useAuthStore.getState().logout

function renderMenu(user = makeUser()) {
  useAuthStore.setState({ user })
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <p>Außerhalb</p>
      <Link to="/exam">Anderswo</Link>
      <AccountMenu />
      <Routes>
        <Route path="/" element={<p>Landing page</p>} />
        <Route path="/learn" element={<p>Learn page</p>} />
        <Route path="/exam" element={<p>Exam page</p>} />
        <Route path="/profile" element={<p>Profile page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function menuButton() {
  return screen.getByRole('button', { name: 'Menü' })
}

describe('AccountMenu', () => {
  afterEach(() => {
    useAuthStore.setState({ logout: originalLogout })
  })

  it('starts closed and opens on click', async () => {
    renderMenu()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Profil' })).not.toBeInTheDocument()

    await userEvent.click(menuButton())

    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(menuButton()).toHaveAttribute('aria-controls', 'account-menu')
    expect(document.getElementById('account-menu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Tokens' })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/faq')
    expect(screen.getByRole('link', { name: 'Prüfungsablauf' })).toHaveAttribute('href', '/exam-process')
    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:kontakt@sks-lotse\.de/),
    )
  })

  it('says who is signed in', async () => {
    renderMenu(makeUser({ email: 'anna@example.com' }))
    await userEvent.click(menuButton())
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
    expect(screen.getByText(/Angemeldet als/)).toBeInTheDocument()
  })

  it('shows the Admin link only to admins', async () => {
    const { unmount } = renderMenu(makeUser({ is_admin: false }))
    await userEvent.click(menuButton())
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    unmount()

    renderMenu(makeUser({ is_admin: true }))
    await userEvent.click(menuButton())
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
  })

  it('closes on a second click of the button', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    await userEvent.click(menuButton())
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes on Escape and hands focus back to the button', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    screen.getByRole('link', { name: 'FAQ' }).focus()

    await userEvent.keyboard('{Escape}')

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveFocus()
  })

  it('ignores other keys', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    await userEvent.keyboard('a')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes on a click outside, but not on one inside', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    await userEvent.click(screen.getByText(/Angemeldet als/))
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(screen.getByText('Außerhalb'))

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when an entry is chosen, and on any route change', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    await userEvent.click(screen.getByRole('link', { name: 'Profil' }))
    expect(await screen.findByText('Profile page')).toBeInTheDocument()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(menuButton())
    await userEvent.click(screen.getByRole('link', { name: 'Feedback' }))
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('stays closed after navigating away while open', async () => {
    renderMenu()
    await userEvent.click(menuButton())
    // A keyboard route change that doesn't go through the menu or a pointer outside it.
    screen.getByRole('link', { name: 'Anderswo' }).focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByText('Exam page')).toBeInTheDocument()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('logs out and returns to the landing page', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    renderMenu()
    useAuthStore.setState({ logout })
    await userEvent.click(menuButton())

    await userEvent.click(screen.getByRole('button', { name: 'Abmelden' }))

    expect(logout).toHaveBeenCalledOnce()
    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })
})
