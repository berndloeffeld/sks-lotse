import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AccountNav } from './AccountNav'

const baseUser = {
  id: 1,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: null,
  first_name: null,
  last_name: null,
  gender: null,
  ai_grading_enabled: false,
  ai_checks_remaining: 20,
}

describe('AccountNav', () => {
  it('shows the Admin link only to admins', () => {
    useAuthStore.setState({ user: { ...baseUser, is_admin: false } })
    const { unmount } = render(
      <MemoryRouter>
        <AccountNav />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    unmount()

    useAuthStore.setState({ user: { ...baseUser, is_admin: true } })
    render(
      <MemoryRouter>
        <AccountNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
  })

  it('links to the feedback mail', () => {
    useAuthStore.setState({ user: { ...baseUser, is_admin: false } })
    render(
      <MemoryRouter>
        <AccountNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Feedback' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^mailto:kontakt@sks-lotse\.de/),
    )
  })
})
