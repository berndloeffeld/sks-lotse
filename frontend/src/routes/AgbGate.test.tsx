import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AGB_VERSION } from '../legal'
import { useAuthStore } from '../store/authStore'
import { AgbGate } from './AgbGate'
import { jsonResponse, makeUser } from '../test/fixtures'

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/learn']}>
      <Routes>
        <Route path="/agb" element={<p>AGB page</p>} />
        <Route element={<AgbGate />}>
          <Route path="/learn" element={<p>Learn page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AgbGate', () => {
  it('renders the protected content without a dialog when the current AGB version is already accepted', () => {
    useAuthStore.setState({ user: makeUser({ agb_accepted_version: AGB_VERSION }) })

    renderGate()

    expect(screen.getByText('Learn page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('overlays a confirmation dialog on the still-visible page when no version has been accepted yet', () => {
    useAuthStore.setState({ user: makeUser({ agb_accepted_version: null }) })

    renderGate()

    // The page underneath stays rendered — no jarring full-page swap.
    expect(screen.getByText('Learn page')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ich akzeptiere die AGB' })).toBeInTheDocument()
  })

  it('overlays a confirmation dialog when an older version was accepted', () => {
    useAuthStore.setState({ user: makeUser({ agb_accepted_version: '2020-01-01' }) })

    renderGate()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('dismisses the dialog after confirming', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser({ agb_accepted_version: null }) })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(makeUser({ agb_accepted_version: AGB_VERSION })))
    vi.stubGlobal('fetch', fetchMock)

    renderGate()
    await user.click(screen.getByRole('button', { name: 'Ich akzeptiere die AGB' }))

    expect(screen.getByText('Learn page')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/agb-accept'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows an error message and keeps the dialog open when confirming fails', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: makeUser({ agb_accepted_version: null }) })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'nope' }, 500)))

    renderGate()
    await user.click(screen.getByRole('button', { name: 'Ich akzeptiere die AGB' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Das hat nicht geklappt.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
