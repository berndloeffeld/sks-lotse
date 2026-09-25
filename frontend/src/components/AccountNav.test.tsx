import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountNav } from './AccountNav'
import { makeUser } from '../test/fixtures'

function renderAt(path: string) {
  useAuthStore.setState({ user: makeUser() })
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

  it('keeps everything else in the menu, not in the bar', () => {
    renderAt('/profile')

    for (const name of ['FAQ', 'Prüfungsablauf', 'Tokens', 'Profil', 'Feedback']) {
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
