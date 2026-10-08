import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { MainNav } from './MainNav'
import { makeUser } from '../test/fixtures'

function renderAt(path: string, user = makeUser()) {
  useAuthStore.setState({ user })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MainNav />
    </MemoryRouter>,
  )
}

const charts = makeUser({ can_use_chart_exercises: true })

describe('MainNav', () => {
  it('leads with Lernen and Prüfung, then the token balance and the Konto menu', () => {
    renderAt('/profile')

    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: 'Probeprüfung' })).toHaveAttribute('href', '/exam')
    expect(screen.getByRole('link', { name: /Tokens – zu den Preisen/ })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('button', { name: 'Konto' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Kartenaufgaben' })).not.toBeInTheDocument()
  })

  it('splits into Fragen and Kartenaufgaben where the feature flag covers the account', () => {
    renderAt('/charts/1', charts)

    expect(screen.getByRole('link', { name: 'Fragen' })).toHaveAttribute('href', '/learn')
    expect(screen.getByRole('link', { name: 'Kartenaufgaben' })).toHaveAttribute('href', '/charts')
    expect(screen.getByRole('link', { name: 'Kartenaufgaben' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Probeprüfung' })).not.toBeInTheDocument()
  })

  it('keeps the content pages out of the bar', () => {
    renderAt('/profile')

    for (const name of ['FAQ', 'Prüfungsablauf', 'Shop', 'Profil', 'Feedback']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Abmelden' })).not.toBeInTheDocument()
  })

  it('marks the current area, including its sub-pages', () => {
    const { unmount } = renderAt('/learn/focus')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Probeprüfung' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('border-surface')
    unmount()

    renderAt('/exam/7')
    expect(screen.getByRole('link', { name: 'Probeprüfung' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Lernen' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('border-transparent')
  })

  it('leaves the areas and the menu to the tab bar on phones', () => {
    renderAt('/learn')

    expect(screen.getByRole('link', { name: 'Lernen' })).toHaveClass('hidden', 'md:inline')
    expect(screen.getByRole('button', { name: 'Konto' }).closest('div.hidden')).toHaveClass('md:block')
  })
})
