import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { AdminPage } from './AdminPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderAdminPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/start" element={<p>Start page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const foundUser = {
  id: 42,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: 'motor',
  question_progress_count: 3,
}

function setAdminSession() {
  useAuthStore.setState({
    user: {
      id: 1,
      email: 'admin@example.com',
      created_at: '2026-01-01T00:00:00Z',
      exam_variant: null,
      is_admin: true,
    },
    isAuthenticated: true,
    isLoading: false,
  })
}

describe('AdminPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  })

  it('redirects a non-admin, authenticated user to /start', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'learner@example.com',
        created_at: '2026-01-01T00:00:00Z',
        exam_variant: null,
        is_admin: false,
      },
      isAuthenticated: true,
      isLoading: false,
    })

    renderAdminPage()

    expect(screen.getByText('Start page')).toBeInTheDocument()
  })

  it('finds a user by email and shows their data', async () => {
    const user = userEvent.setup()
    setAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/admin/users/search')) return jsonResponse(foundUser)
        throw new Error(`unexpected fetch to ${url}`)
      }),
    )

    renderAdminPage()
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('learner@example.com')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows an inline error when no user is found', async () => {
    const user = userEvent.setup()
    setAdminSession()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not Found' }, 404)))

    renderAdminPage()
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('Kein Nutzer mit dieser E-Mail-Adresse gefunden.')).toBeInTheDocument()
  })

  it('keeps the final delete button disabled until the exact email is retyped, then deletes', async () => {
    const user = userEvent.setup()
    setAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/admin/users/search')) return jsonResponse(foundUser)
        if (url.endsWith(`/admin/users/${foundUser.id}`) && init?.method === 'DELETE') {
          return new Response(null, { status: 204 })
        }
        throw new Error(`unexpected fetch to ${url}`)
      }),
    )

    renderAdminPage()
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))
    await screen.findByText('learner@example.com')

    await user.click(screen.getByRole('button', { name: 'Account löschen' }))
    const confirmButton = screen.getByRole('button', { name: 'Endgültig löschen' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'wrong@example.com')
    expect(confirmButton).toBeDisabled()

    await user.clear(screen.getByLabelText(/Zur Bestätigung/))
    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'learner@example.com')
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(await screen.findByText('Account learner@example.com wurde gelöscht.')).toBeInTheDocument()
    expect(screen.queryByText('Endgültig löschen')).not.toBeInTheDocument()
  })

  it('triggers a JSON file download when exporting', async () => {
    const user = userEvent.setup()
    setAdminSession()
    const exportPayload = {
      user: foundUser,
      question_progress: [],
      exported_at: '2026-01-01T00:00:00Z',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/admin/users/search')) return jsonResponse(foundUser)
        if (url.endsWith(`/admin/users/${foundUser.id}/export`)) return jsonResponse(exportPayload)
        throw new Error(`unexpected fetch to ${url}`)
      }),
    )
    // jsdom doesn't implement these — assign them directly (not via
    // vi.stubGlobal, which would replace the whole URL class and drop its
    // other static members).
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    renderAdminPage()
    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))
    await screen.findByText('learner@example.com')

    await user.click(screen.getByRole('button', { name: 'Daten exportieren' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
