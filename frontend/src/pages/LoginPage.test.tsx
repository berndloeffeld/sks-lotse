import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LoginPage } from './LoginPage'
import { jsonResponse } from '../test/fixtures'

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/learn" element={<p>Learn page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('walks through the two-step OTP flow to a successful login', async () => {
    const user = userEvent.setup()
    const mockUser = { id: 1, email: 'learner@example.com', created_at: '2026-01-01T00:00:00Z' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/auth/otp/request')) return jsonResponse({ detail: 'sent' }, 202)
        if (url.endsWith('/auth/otp/verify')) return jsonResponse({ access_token: 'x', token_type: 'bearer' })
        if (url.endsWith('/auth/me')) return jsonResponse(mockUser)
        throw new Error(`unexpected fetch to ${url}`)
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Jetzt starten' }))

    await user.type(await screen.findByLabelText('Login-Code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Learn page')).toBeInTheDocument()
  })

  it('shows an inline error when the code is rejected', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/auth/otp/request')) return jsonResponse({ detail: 'sent' }, 202)
        if (url.endsWith('/auth/otp/verify')) return jsonResponse({ detail: 'Invalid or expired code' }, 401)
        throw new Error(`unexpected fetch to ${url}`)
      }),
    )

    renderLoginPage()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Jetzt starten' }))

    await user.type(await screen.findByLabelText('Login-Code'), '000000')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Der Code ist ungültig oder abgelaufen.')).toBeInTheDocument()
  })

  it('lets the learner go back and use a different email address', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'sent' }, 202)))

    renderLoginPage()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Jetzt starten' }))
    await screen.findByLabelText('Login-Code')

    await user.click(screen.getByRole('button', { name: 'Andere E-Mail-Adresse verwenden' }))

    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
  })

  it('redirects to /learn immediately when already authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true })

    renderLoginPage()

    expect(screen.getByText('Learn page')).toBeInTheDocument()
  })
})
