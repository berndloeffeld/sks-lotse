import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LoginPage } from './LoginPage'
import { jsonResponse } from '../test/fixtures'

// `state` is what ProtectedRoute or a guest's login link hands over (returnPath.ts).
function renderLoginPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/learn" element={<p>Learn page</p>} />
        <Route path="/pricing" element={<p>Pricing page</p>} />
        <Route path="/exam/:id" element={<p>Exam run page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function stubLoginApi() {
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
}

async function logIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
  await user.click(screen.getByRole('button', { name: 'Code anfordern' }))
  await user.type(await screen.findByLabelText('Login-Code'), '123456')
  await user.click(screen.getByRole('button', { name: 'Anmelden' }))
}

describe('LoginPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionExpired: false })
  })

  it('walks through the two-step OTP flow to a successful login, then on to /learn', async () => {
    const user = userEvent.setup()
    stubLoginApi()

    renderLoginPage()
    await logIn(user)

    expect(await screen.findByText('Learn page')).toBeInTheDocument()
  })

  it('goes back to the page the login was asked for', async () => {
    const user = userEvent.setup()
    stubLoginApi()

    renderLoginPage({ from: '/pricing' })
    await logIn(user)

    expect(await screen.findByText('Pricing page')).toBeInTheDocument()
  })

  it('does not follow a return target that leaves the app', async () => {
    const user = userEvent.setup()
    stubLoginApi()

    renderLoginPage({ from: '//evil.example' })
    await logIn(user)

    expect(await screen.findByText('Learn page')).toBeInTheDocument()
  })

  it('says why the learner is here when their session expired', () => {
    useAuthStore.setState({ sessionExpired: true })

    renderLoginPage({ from: '/exam/12' })

    expect(screen.getByRole('status')).toHaveTextContent('Deine Sitzung ist abgelaufen.')
    expect(screen.getByRole('button', { name: 'Code anfordern' })).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))

    await user.type(await screen.findByLabelText('Login-Code'), '000000')
    await user.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Der Code ist ungültig oder abgelaufen.')).toBeInTheDocument()
  })

  it('lets the learner go back and use a different email address', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'sent' }, 202)))

    renderLoginPage()

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Code anfordern' }))
    await screen.findByLabelText('Login-Code')

    await user.click(screen.getByRole('button', { name: 'Andere E-Mail-Adresse verwenden' }))

    expect(screen.getByLabelText('E-Mail-Adresse')).toBeInTheDocument()
  })

  it('redirects to /learn immediately when already authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true })

    renderLoginPage()

    expect(screen.getByText('Learn page')).toBeInTheDocument()
  })

  it('redirects to the return target when already authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true })

    renderLoginPage({ from: '/exam/12' })

    expect(screen.getByText('Exam run page')).toBeInTheDocument()
  })

  it('redirects to /learn, not to another host, when already authenticated', () => {
    useAuthStore.setState({ isAuthenticated: true })

    renderLoginPage({ from: 'https://evil.example/' })

    expect(screen.getByText('Learn page')).toBeInTheDocument()
  })
})
