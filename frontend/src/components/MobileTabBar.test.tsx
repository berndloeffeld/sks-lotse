import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { MobileTabBar } from './MobileTabBar'
import { makeUser } from '../test/fixtures'

function renderAt(path: string, user = makeUser()) {
  useAuthStore.setState({ user })
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileTabBar />
    </MemoryRouter>,
  )
  return screen.getByRole('navigation', { name: 'Hauptnavigation mobil' })
}

describe('MobileTabBar', () => {
  it('has Lernen, Prüfung and Konto as tabs, only on phones', () => {
    const bar = renderAt('/learn/navigation/gezeiten')

    expect(bar).toHaveClass('fixed', 'bottom-0', 'md:hidden')
    expect(within(bar).getByRole('link', { name: 'Lernen' })).toHaveAttribute('href', '/learn')
    expect(within(bar).getByRole('link', { name: 'Lernen' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'Lernen' })).toHaveClass('text-primary')
    expect(within(bar).getByRole('link', { name: 'Probeprüfung' })).not.toHaveAttribute('aria-current')
    expect(within(bar).getByRole('link', { name: 'Probeprüfung' })).toHaveClass('text-ink-soft')
    expect(within(bar).getByRole('button', { name: 'Konto' })).toBeInTheDocument()
  })

  it('has Fragen and Kartenaufgaben where the feature flag covers the account', () => {
    const bar = renderAt('/exam', makeUser({ can_use_chart_exercises: true }))

    expect(
      within(bar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Fragen', 'Kartenaufgaben'])
    expect(within(bar).getByRole('link', { name: 'Fragen' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'Kartenaufgaben' })).toHaveAttribute('href', '/charts')
  })

  it('opens the Konto menu above the bar', async () => {
    const bar = renderAt('/learn')
    const button = within(bar).getByRole('button', { name: 'Konto' })

    await userEvent.click(button)

    expect(button).toHaveAttribute('aria-controls', 'account-menu-tabbar')
    const menu = document.getElementById('account-menu-tabbar')
    expect(menu).toHaveClass('bottom-full')
    expect(within(menu as HTMLElement).getByRole('link', { name: 'Lernstand' })).toHaveAttribute('href', '/profile')
    expect(button).toHaveClass('text-primary')
  })
})
