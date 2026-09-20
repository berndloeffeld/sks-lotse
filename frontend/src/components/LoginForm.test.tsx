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

  it('offers a button per configured SSO provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ providers: ['facebook', 'google', 'x'] }), { status: 200 })),
    )
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    const google = await screen.findByRole('link', { name: 'Mit Google anmelden' })
    expect(google).toHaveAttribute('href', expect.stringContaining('/api/v1/auth/sso/google/start'))
    expect(screen.getByRole('link', { name: 'Mit Facebook anmelden' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /x anmelden/i })).not.toBeInTheDocument()
  })

  it('shows no SSO button when the providers cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Code anfordern' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /anmelden/ })).not.toBeInTheDocument()
  })

  it.each([
    ['cancelled', 'Die Anmeldung wurde abgebrochen.'],
    ['no_email', 'Der Anbieter hat keine bestätigte E-Mail-Adresse geliefert. Bitte melde dich per E-Mail-Code an.'],
    ['unknown-code', 'Die Anmeldung über den Anbieter ist fehlgeschlagen. Bitte erneut versuchen.'],
  ])('explains an SSO error (%s)', async (code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ providers: [] }), { status: 200 })),
    )
    render(
      <MemoryRouter initialEntries={[`/login?sso_error=${code}`]}>
        <LoginForm />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
