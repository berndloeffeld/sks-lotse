import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminBlocklistPage } from './AdminBlocklistPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function entry(id: number, overrides: object = {}) {
  return {
    id,
    kind: 'email',
    value: `spam${id}@example.com`,
    reason: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: 'admin@example.com',
    ...overrides,
  }
}

function stubFetch(
  onList: () => Response,
  onCreate?: (body: unknown) => Response,
  onDelete?: (id: string) => Response,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/admin/blocklist') && init?.method === undefined) return onList()
    if (url.endsWith('/admin/blocklist') && init?.method === 'POST' && onCreate) {
      return onCreate(JSON.parse(String(init.body)))
    }
    const deleteMatch = /\/admin\/blocklist\/(\d+)$/.exec(url)
    if (deleteMatch && init?.method === 'DELETE' && onDelete) return onDelete(deleteMatch[1])
    throw new Error(`unexpected fetch to ${url} (${init?.method ?? 'GET'})`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AdminBlocklistPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the blocked entries', async () => {
    stubFetch(() => jsonResponse([entry(1), entry(2, { kind: 'domain', value: 'spammy.example', reason: 'abuse' })]))
    render(<AdminBlocklistPage />)

    expect(await screen.findByText('spam1@example.com')).toBeInTheDocument()
    expect(screen.getByText('spammy.example')).toBeInTheDocument()
    expect(screen.getByText('abuse')).toBeInTheDocument()
  })

  it('shows a message when nothing is blocked', async () => {
    stubFetch(() => jsonResponse([]))
    render(<AdminBlocklistPage />)

    expect(await screen.findByText('Keine gesperrten Adressen oder Domains.')).toBeInTheDocument()
  })

  it('shows an error when the list cannot be loaded', async () => {
    stubFetch(() => new Response(null, { status: 500 }))
    render(<AdminBlocklistPage />)

    expect(await screen.findByText('Die Sperrliste konnte nicht geladen werden.')).toBeInTheDocument()
  })

  it('adds a new blocked email and prepends it to the list', async () => {
    const user = userEvent.setup()
    stubFetch(
      () => jsonResponse([]),
      (body) => jsonResponse(entry(9, body as object)),
    )
    render(<AdminBlocklistPage />)
    await screen.findByText('Keine gesperrten Adressen oder Domains.')

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'new-spam@example.com')
    await user.click(screen.getByRole('button', { name: 'Sperren' }))

    expect(await screen.findByText('new-spam@example.com')).toBeInTheDocument()
    expect(screen.getByLabelText('E-Mail-Adresse')).toHaveValue('')
  })

  it('adds a blocked domain via the kind selector', async () => {
    const user = userEvent.setup()
    let sentBody: unknown
    stubFetch(
      () => jsonResponse([]),
      (body) => {
        sentBody = body
        return jsonResponse(entry(9, body as object))
      },
    )
    render(<AdminBlocklistPage />)
    await screen.findByText('Keine gesperrten Adressen oder Domains.')

    await user.selectOptions(screen.getByLabelText('Art'), 'domain')
    await user.type(screen.getByLabelText('Domain'), 'spammy.example')
    await user.click(screen.getByRole('button', { name: 'Sperren' }))

    await screen.findByText('spammy.example')
    expect(sentBody).toEqual({ kind: 'domain', value: 'spammy.example' })
  })

  it('shows an error when adding an entry fails', async () => {
    const user = userEvent.setup()
    stubFetch(
      () => jsonResponse([]),
      () => new Response(null, { status: 422 }),
    )
    render(<AdminBlocklistPage />)
    await screen.findByText('Keine gesperrten Adressen oder Domains.')

    await user.type(screen.getByLabelText('E-Mail-Adresse'), 'bad')
    await user.click(screen.getByRole('button', { name: 'Sperren' }))

    expect(await screen.findByText('Der Eintrag konnte nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('removes an entry', async () => {
    const user = userEvent.setup()
    stubFetch(
      () => jsonResponse([entry(1)]),
      undefined,
      () => new Response(null, { status: 204 }),
    )
    render(<AdminBlocklistPage />)
    await screen.findByText('spam1@example.com')

    await user.click(screen.getByRole('button', { name: 'Entsperren' }))

    expect(await screen.findByText('Keine gesperrten Adressen oder Domains.')).toBeInTheDocument()
  })

  it('shows an error when removing an entry fails', async () => {
    const user = userEvent.setup()
    stubFetch(
      () => jsonResponse([entry(1)]),
      undefined,
      () => new Response(null, { status: 500 }),
    )
    render(<AdminBlocklistPage />)
    await user.click(await screen.findByRole('button', { name: 'Entsperren' }))

    expect(await screen.findByText('Der Eintrag konnte nicht entfernt werden.')).toBeInTheDocument()
    // The entry stays, since the removal failed.
    expect(screen.getByText('spam1@example.com')).toBeInTheDocument()
  })
})
