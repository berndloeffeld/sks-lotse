import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { AdminUserPage } from './AdminUserPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function UsersListStub() {
  const state = useLocation().state as { deleted?: string } | null
  return <p>User list (deleted: {state?.deleted})</p>
}

function renderUserPage(id = 42) {
  return render(
    <MemoryRouter initialEntries={[`/admin/users/${id}`]}>
      <Routes>
        <Route path="/admin/users/:id" element={<AdminUserPage />} />
        <Route path="/admin/users" element={<UsersListStub />} />
      </Routes>
    </MemoryRouter>,
  )
}

const foundUser = {
  id: 42,
  email: 'learner@example.com',
  created_at: '2026-01-01T00:00:00Z',
  exam_variant: 'motor',
  first_name: 'Anna',
  last_name: 'Beispiel',
  gender: 'weiblich',
  token_balance: 0,
  ads_removed: false,
  ai_checks_used: 4,
  ai_checks_weekly_limit: null,
  ai_checks_limit: 100,
  ai_flags_count: 0,
  ai_flags_last_at: null,
  question_progress_count: 3,
}

// GET /admin/users/42 answers `user`; anything else goes to `other` (or fails the test).
function stubFetch(
  other: (url: string, init?: RequestInit) => Response | undefined = () => undefined,
  user: unknown = foundUser,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith(`/admin/users/${foundUser.id}`) && init?.method === undefined) return jsonResponse(user)
    const response = other(url, init)
    if (response) return response
    throw new Error(`unexpected fetch to ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// PATCH echoes the change back, like the backend does.
const echoPatch = (url: string, init?: RequestInit) =>
  url.endsWith(`/admin/users/${foundUser.id}`) && init?.method === 'PATCH'
    ? jsonResponse({ ...foundUser, ...JSON.parse(String(init.body)) })
    : undefined

const failPatch = (_url: string, init?: RequestInit) =>
  init?.method === 'PATCH' ? new Response(null, { status: 500 }) : undefined

describe('AdminUserPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the account and shows its data', async () => {
    stubFetch()
    renderUserPage()

    expect(await screen.findByText('learner@example.com')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Anna Beispiel')).toBeInTheDocument()
    // Stored keys are shown with the same labels the learner's own pages use.
    expect(screen.getByText('Weiblich')).toBeInTheDocument()
    expect(screen.getByText('Prüfungsvariante').nextElementSibling).toHaveTextContent('Motor')
    expect(screen.getByRole('link', { name: '← Alle Benutzer' })).toHaveAttribute('href', '/admin/users')
  })

  it('shows a dash for profile fields the learner left blank', async () => {
    stubFetch(undefined, { ...foundUser, first_name: null, last_name: null, gender: null, exam_variant: null })
    renderUserPage()

    await screen.findByText('learner@example.com')
    expect(screen.getByText('Name').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Geschlecht').nextElementSibling).toHaveTextContent('—')
    expect(screen.getByText('Prüfungsvariante').nextElementSibling).toHaveTextContent('—')
  })

  it('says so when the account does not exist', async () => {
    stubFetch((url) => (url.endsWith('/admin/users/7') ? jsonResponse({ detail: 'Not Found' }, 404) : undefined))
    renderUserPage(7)

    expect(await screen.findByText('Benutzer nicht gefunden.')).toBeInTheDocument()
    expect(screen.queryByText('Der Benutzer konnte nicht geladen werden.')).not.toBeInTheDocument()
  })

  it('does not report "not found" when loading itself failed', async () => {
    stubFetch((url) => (url.endsWith('/admin/users/7') ? jsonResponse({ detail: 'Too many' }, 429) : undefined))
    renderUserPage(7)

    expect(await screen.findByText('Der Benutzer konnte nicht geladen werden.')).toBeInTheDocument()
    expect(screen.queryByText('Benutzer nicht gefunden.')).not.toBeInTheDocument()
  })

  it('keeps the final delete button disabled until the exact email is retyped, then deletes', async () => {
    const user = userEvent.setup()
    stubFetch((url, init) =>
      url.endsWith(`/admin/users/${foundUser.id}`) && init?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : undefined,
    )
    renderUserPage()
    await screen.findByText('learner@example.com')

    await user.click(screen.getByRole('button', { name: 'Account löschen' }))
    const confirmButton = screen.getByRole('button', { name: 'Endgültig löschen' })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'wrong@example.com')
    expect(confirmButton).toBeDisabled()

    await user.clear(screen.getByLabelText(/Zur Bestätigung/))
    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'LEARNER@example.com ')
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    // Back on the list, which confirms the deletion.
    expect(await screen.findByText('User list (deleted: learner@example.com)')).toBeInTheDocument()
  })

  it('stays on the page with an error when deleting fails', async () => {
    const user = userEvent.setup()
    stubFetch((_url, init) => (init?.method === 'DELETE' ? new Response(null, { status: 500 }) : undefined))
    renderUserPage()
    await user.click(await screen.findByRole('button', { name: 'Account löschen' }))
    await user.type(screen.getByLabelText(/Zur Bestätigung/), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }))

    expect(await screen.findByText('Der Account konnte nicht gelöscht werden.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Endgültig löschen' })).toBeEnabled()
  })

  it('grants tokens to the account, optionally recording what they paid', async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    stubFetch((url, init) => {
      if (!(url.endsWith(`/admin/users/${foundUser.id}`) && init?.method === 'PATCH')) return undefined
      const body = JSON.parse(String(init.body)) as { grant_tokens: number }
      bodies.push(body)
      return jsonResponse({ ...foundUser, token_balance: foundUser.token_balance + body.grant_tokens })
    })
    renderUserPage()
    expect(await screen.findByText('Tokens gutschreiben (aktuell: 0)')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Tokens gutschreiben/), '20')
    await user.type(screen.getByLabelText(/Erhaltener Betrag/), '2.99')
    await user.click(screen.getByRole('button', { name: 'Tokens gutschreiben' }))

    expect(await screen.findByText('Tokens gutschreiben (aktuell: 20)')).toBeInTheDocument()
    expect(bodies).toEqual([{ grant_tokens: 20, grant_amount_eur_cents: 299 }])
    // The inputs reset so a second grant doesn't accidentally resubmit the same amount.
    expect(screen.getByLabelText(/Tokens gutschreiben/)).toHaveValue(null)
  })

  it('rejects an invalid token amount without calling the backend', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch()
    renderUserPage()
    await screen.findByText('learner@example.com')
    fetchMock.mockClear()

    await user.click(screen.getByRole('button', { name: 'Tokens gutschreiben' }))
    expect(screen.getByText('Bitte eine ganze Zahl ab 1 eingeben.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('removes and restores ads', async () => {
    const user = userEvent.setup()
    stubFetch(echoPatch)
    renderUserPage()
    await screen.findByText('Aktiv')

    await user.click(screen.getByRole('button', { name: 'Werbung entfernen' }))
    expect(await screen.findByText('Entfernt')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Werbung wieder aktivieren' }))
    expect(await screen.findByText('Aktiv')).toBeInTheDocument()
  })

  it('shows an error when changing the ads setting fails', async () => {
    const user = userEvent.setup()
    stubFetch(failPatch)
    renderUserPage()
    await user.click(await screen.findByRole('button', { name: 'Werbung entfernen' }))

    expect(await screen.findByText('Die Werbung konnte nicht geändert werden.')).toBeInTheDocument()
  })

  it('shows an error when granting tokens fails', async () => {
    const user = userEvent.setup()
    stubFetch(failPatch)
    renderUserPage()
    await screen.findByText('learner@example.com')
    await user.type(screen.getByLabelText(/Tokens gutschreiben/), '20')
    await user.click(screen.getByRole('button', { name: 'Tokens gutschreiben' }))

    expect(await screen.findByText('Die Tokens konnten nicht gutgeschrieben werden.')).toBeInTheDocument()
  })

  it('shows the sanitizer flags with the time of the last one', async () => {
    stubFetch(undefined, { ...foundUser, ai_flags_count: 2, ai_flags_last_at: '2026-03-04T05:06:00Z' })
    renderUserPage()

    expect(await screen.findByText(/^2 \(zuletzt /)).toBeInTheDocument()
  })

  it('triggers a JSON file download when exporting', async () => {
    const user = userEvent.setup()
    const exportPayload = { user: foundUser, question_progress: [], exported_at: '2026-01-01T00:00:00Z' }
    stubFetch((url) => (url.endsWith(`/admin/users/${foundUser.id}/export`) ? jsonResponse(exportPayload) : undefined))
    // jsdom doesn't implement these — assign them directly (not via
    // vi.stubGlobal, which would replace the whole URL class and drop its
    // other static members).
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL

    renderUserPage()
    await user.click(await screen.findByRole('button', { name: 'Daten exportieren' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('shows an error when the export fails', async () => {
    const user = userEvent.setup()
    stubFetch((url) => (url.endsWith('/export') ? new Response(null, { status: 500 }) : undefined))
    renderUserPage()
    await user.click(await screen.findByRole('button', { name: 'Daten exportieren' }))

    expect(await screen.findByText('Der Export konnte nicht erstellt werden.')).toBeInTheDocument()
  })

  it('sets a per-user weekly limit and resets it to the default', async () => {
    const user = userEvent.setup()
    const bodies: unknown[] = []
    stubFetch((url, init) => {
      if (init?.method === 'PATCH') bodies.push(JSON.parse(String(init.body)))
      return echoPatch(url, init)
    })
    renderUserPage()
    expect(await screen.findByText('4 von 100 (Standard)')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/KI-Prüfungen pro Woche/), '7')
    await user.click(screen.getByRole('button', { name: 'Limit speichern' }))
    expect(await screen.findByText(/\(eigenes Limit\)/)).toBeInTheDocument()
    expect(bodies[0]).toEqual({ ai_checks_weekly_limit: 7 })

    await user.click(screen.getByRole('button', { name: 'Standard verwenden' }))
    expect(await screen.findByText(/\(Standard\)/)).toBeInTheDocument()
    expect(bodies[1]).toEqual({ ai_checks_weekly_limit: null })
    expect(screen.getByLabelText(/KI-Prüfungen pro Woche/)).toHaveValue(null)
  })

  it("prefills the account's own weekly limit", async () => {
    stubFetch(undefined, { ...foundUser, ai_checks_weekly_limit: 9, ai_checks_limit: 9 })
    renderUserPage()

    expect(await screen.findByLabelText(/KI-Prüfungen pro Woche/)).toHaveValue(9)
  })

  it('rejects an invalid weekly limit and reports a failed save', async () => {
    const user = userEvent.setup()
    stubFetch(failPatch)
    renderUserPage()
    await screen.findByText('learner@example.com')

    await user.click(screen.getByRole('button', { name: 'Limit speichern' }))
    expect(screen.getByText('Bitte eine ganze Zahl ab 0 eingeben.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/KI-Prüfungen pro Woche/), '5')
    await user.click(screen.getByRole('button', { name: 'Limit speichern' }))
    expect(await screen.findByText('Das Wochenlimit konnte nicht geändert werden.')).toBeInTheDocument()
  })
})
