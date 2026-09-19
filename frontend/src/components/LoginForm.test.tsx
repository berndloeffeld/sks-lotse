import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { LoginForm } from './LoginForm'

describe('LoginForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders outlined light fields on the dark band variant', () => {
    render(
      <MemoryRouter>
        <LoginForm tone="dark" />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveClass('border-surface')
  })

  it('goes back to the email step from the code step', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ detail: 'sent' }), { status: 202 })),
    )
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))
    await user.click(await screen.findByRole('button', { name: 'Andere E-Mail-Adresse verwenden' }))

    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
  })
})
