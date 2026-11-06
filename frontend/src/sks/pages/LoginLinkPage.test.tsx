import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LoginLinkPage } from './LoginLinkPage'
import { jsonResponse } from '../../test/fixtures'

const TOKEN = 'a'.repeat(43)

function ShowHash() {
  return <p data-testid="hash">{useLocation().hash}</p>
}

function renderPage(hash = `#t=${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login/link', hash }]}>
      <Routes>
        <Route
          path="/login/link"
          element={
            <>
              <LoginLinkPage />
              <ShowHash />
            </>
          }
        />
        <Route path="/learn" element={<p>Learn page</p>} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function stubApi(verifyStatus = 200) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    if (url.endsWith('/auth/otp/verify-link')) {
      return verifyStatus === 200
        ? jsonResponse({ access_token: null, token_type: 'bearer' })
        : jsonResponse({ detail: 'Invalid or expired code' }, verifyStatus)
    }
    if (url.endsWith('/auth/me')) return jsonResponse({ id: 1, email: 'learner@example.com' })
    throw new Error(`unexpected fetch to ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('LoginLinkPage', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false, sessionExpired: false })
  })

  it('signs in only on the click, then goes on to /learn', async () => {
    const user = userEvent.setup()
    const fetchMock = stubApi()

    renderPage()
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Jetzt anmelden' }))

    expect(await screen.findByText('Learn page')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/auth\/otp\/verify-link$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ token: TOKEN })
  })

  it('clears the token from the URL right away', async () => {
    stubApi()

    renderPage()

    expect(await screen.findByTestId('hash')).toHaveTextContent(/^$/)
    expect(screen.getByRole('button', { name: 'Jetzt anmelden' })).toBeInTheDocument()
  })

  it('says so when the link is used up or expired', async () => {
    const user = userEvent.setup()
    stubApi(401)

    renderPage()
    await user.click(screen.getByRole('button', { name: 'Jetzt anmelden' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ungültig, abgelaufen oder wurde schon benutzt')
  })

  it.each(['', '#t=', '#x=1'])('offers no button for a link without a token (%j)', (hash) => {
    stubApi()

    renderPage(hash)

    expect(screen.queryByRole('button', { name: 'Jetzt anmelden' })).not.toBeInTheDocument()
    expect(screen.getByText(/unvollständig/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Code eingeben oder neu anfordern' })).toHaveAttribute('href', '/login')
  })

  it('sends a learner who is already signed in on to /learn', async () => {
    useAuthStore.setState({ isAuthenticated: true })

    renderPage()

    expect(await screen.findByText('Learn page')).toBeInTheDocument()
  })
})
