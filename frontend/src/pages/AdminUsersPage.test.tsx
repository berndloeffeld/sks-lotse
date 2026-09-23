import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminUsersPage } from './AdminUsersPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function listItem(id: number, overrides: object = {}) {
  return {
    id,
    email: `user${id}@example.com`,
    first_name: null,
    last_name: null,
    created_at: '2026-01-01T00:00:00Z',
    ai_grading_enabled: false,
    ads_removed: false,
    ...overrides,
  }
}

function renderPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/users', state }]}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function stubFetch(respond: (params: URLSearchParams) => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname.endsWith('/admin/users')) return respond(url.searchParams)
    throw new Error(`unexpected fetch to ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AdminUsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the accounts, each linking to its detail page', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({
        items: [
          listItem(2, { first_name: 'Anna', last_name: 'Schmidt', ai_grading_enabled: true, ads_removed: true }),
          listItem(1),
        ],
        total: 2,
      }),
    )
    renderPage()

    expect(await screen.findByText('2 Benutzer')).toBeInTheDocument()
    const first = screen.getByRole('link', { name: /user2@example\.com/ })
    expect(first).toHaveAttribute('href', '/admin/users/2')
    expect(within(first).getByText('Anna Schmidt')).toBeInTheDocument()
    expect(within(first).getByText('KI')).toBeInTheDocument()
    expect(within(first).getByText('Werbefrei')).toBeInTheDocument()
    const second = screen.getByRole('link', { name: /user1@example\.com/ })
    expect(within(second).getByText('—')).toBeInTheDocument()
    expect(within(second).queryByText('KI')).not.toBeInTheDocument()
    // Everything fits one page: no "load more".
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument()
    const params = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost').searchParams
    expect(Object.fromEntries(params)).toEqual({ q: '', offset: '0', limit: '50' })
  })

  it('searches with the trimmed term', async () => {
    const user = userEvent.setup()
    const fetchMock = stubFetch((params) =>
      params.get('q') === 'anna'
        ? jsonResponse({ items: [listItem(2)], total: 1 })
        : jsonResponse({ items: [listItem(2), listItem(1)], total: 2 }),
    )
    renderPage()
    await screen.findByText('2 Benutzer')

    await user.type(screen.getByLabelText('E-Mail oder Name'), '  anna ')
    await user.click(screen.getByRole('button', { name: 'Suchen' }))

    expect(await screen.findByText('1 Benutzer für „anna“')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows nothing but the count when no account matches', async () => {
    stubFetch(() => jsonResponse({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('0 Benutzer')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('loads the next page on demand and appends it', async () => {
    const user = userEvent.setup()
    stubFetch((params) =>
      params.get('offset') === '0'
        ? jsonResponse({ items: [listItem(3), listItem(2)], total: 3 })
        : jsonResponse({ items: [listItem(1)], total: 3 }),
    )
    renderPage()
    await screen.findByText('3 Benutzer')

    await user.click(screen.getByRole('button', { name: 'Mehr laden' }))

    expect(await screen.findByRole('link', { name: /user1@example\.com/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Mehr laden' })).not.toBeInTheDocument()
  })

  it('reports a failed next page and keeps the list', async () => {
    const user = userEvent.setup()
    stubFetch((params) =>
      params.get('offset') === '0'
        ? jsonResponse({ items: [listItem(2)], total: 2 })
        : new Response(null, { status: 500 }),
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Mehr laden' }))

    expect(await screen.findByText('Weitere Benutzer konnten nicht geladen werden.')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Mehr laden' })).toBeEnabled()
  })

  it('shows an error when the list cannot be loaded', async () => {
    stubFetch(() => new Response(null, { status: 500 }))
    renderPage()

    expect(await screen.findByText('Die Benutzerliste konnte nicht geladen werden.')).toBeInTheDocument()
  })

  it('confirms an account deleted on its detail page', async () => {
    stubFetch(() => jsonResponse({ items: [], total: 0 }))
    renderPage({ deleted: 'gone@example.com' })

    expect(screen.getByText('Account gone@example.com wurde gelöscht.')).toBeInTheDocument()
    await screen.findByText('0 Benutzer')
  })
})
