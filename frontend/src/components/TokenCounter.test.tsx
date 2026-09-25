import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { makeUser } from '../test/fixtures'
import { TokenCounter } from './TokenCounter'

function renderAt(path: string, tokens: number | null) {
  useAuthStore.setState({ user: tokens === null ? null : makeUser({ token_balance: tokens }) })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TokenCounter />
    </MemoryRouter>,
  )
}

describe('TokenCounter', () => {
  beforeEach(() => useAuthStore.setState({ user: null }))

  it('shows the balance and links to the token packages', () => {
    renderAt('/learn', 20)

    const link = screen.getByRole('link', { name: /^20 Tokens/ })
    expect(link).toHaveAttribute('href', '/pricing')
    expect(link).toHaveTextContent('20')
    expect(link).not.toHaveClass('bg-danger')
    expect(link).not.toHaveClass('bg-success')
  })

  it('turns red below five tokens, but not at five', () => {
    const { unmount } = renderAt('/learn', 4)
    expect(screen.getByRole('link')).toHaveClass('bg-danger')
    unmount()

    renderAt('/learn', 5)
    expect(screen.getByRole('link')).not.toHaveClass('bg-danger')
  })

  it('shows zero tokens', () => {
    renderAt('/learn', 0)
    expect(screen.getByRole('link')).toHaveTextContent('0')
  })

  it('is green right after a purchase, even when the balance is low', () => {
    renderAt('/pricing?checkout=success', 3)
    expect(screen.getByRole('link')).toHaveClass('bg-success')
    expect(screen.getByRole('link')).not.toHaveClass('bg-danger')
  })

  it('renders nothing without a user', () => {
    renderAt('/learn', null)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
