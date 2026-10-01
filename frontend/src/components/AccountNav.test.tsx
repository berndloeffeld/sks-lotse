import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountNav } from './AccountNav'
import { makeUser } from '../test/fixtures'

function renderAt(path: string, user = makeUser()) {
  useAuthStore.setState({ user })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccountNav />
    </MemoryRouter>,
  )
}

describe('AccountNav', () => {
  it('leads with the two learning destinations and the Menü button', () => {
    renderAt('/profile')

    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: 'Prüfung' })).toHaveAttribute('href', '/exam')
    expect(screen.getByRole('button', { name: 'Menü' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('adds the Kartenaufgaben only where the feature flag covers the account', () => {
    const { unmount } = renderAt('/profile')
    expect(screen.queryByRole('link', { name: 'Karte' })).not.toBeInTheDocument()
    unmount()

    renderAt('/charts/1', makeUser({ can_use_chart_exercises: true }))
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('href', '/charts')
    expect(screen.getByRole('link', { name: 'Karte' })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps everything else in the menu, not in the bar', () => {
    renderAt('/profile')

    for (const name of ['FAQ', 'Prüfungsablauf', 'Shop', 'Profil', 'Feedback']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument()
  })

  it('marks the current section, including its sub-pages', () => {
    const { unmount } = renderAt('/learn/focus')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Prüfung' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('border-surface')
    unmount()

    renderAt('/exam/7')
    expect(screen.getByRole('link', { name: 'Prüfung' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Lernen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('border-transparent')
  })
})
