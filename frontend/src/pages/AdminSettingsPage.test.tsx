import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminSettingsPage } from './AdminSettingsPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const SETTINGS = {
  ai_checks_weekly_default: 100,
  price_ads_removed_cents: 500,
  signup_bonus_tokens: 6,
  tokens_s: { tokens: 20, price_cents: 299 },
  tokens_m: { tokens: 50, price_cents: 599 },
  tokens_l: { tokens: 100, price_cents: 999 },
  tokens_xl: { tokens: 200, price_cents: 1699 },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/settings']}>
      <Routes>
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminSettingsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the current settings, prices included', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(SETTINGS)),
    )
    renderPage()

    expect(await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')).toHaveValue(100)
    expect(screen.getByLabelText('Werbefrei, einmalig (€)')).toHaveValue(5)
    expect(screen.getByLabelText('Geschenkte Tokens bei Anmeldung')).toHaveValue(6)
    expect(screen.getByLabelText('Tokens', { selector: '#tokens_s-tokens' })).toHaveValue(20)
    expect(screen.getByLabelText('Preis (€)', { selector: '#tokens_s-price' })).toHaveValue(2.99)
    expect(screen.getByLabelText('Tokens', { selector: '#tokens_xl-tokens' })).toHaveValue(200)
    expect(screen.getByLabelText('Preis (€)', { selector: '#tokens_xl-price' })).toHaveValue(16.99)
  })

  it('saves a changed weekly default together with the unchanged prices', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(init?.method === 'PUT' ? { ...SETTINGS, ai_checks_weekly_default: 40 } : SETTINGS),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    const input = await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await user.clear(input)
    await user.type(input, '40')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ ...SETTINGS, ai_checks_weekly_default: 40 })
  })

  it('saves a changed package price, converted to whole cents', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(init?.method === 'PUT' ? { ...SETTINGS, tokens_s: { tokens: 20, price_cents: 349 } } : SETTINGS),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    const priceInput = await screen.findByLabelText('Preis (€)', { selector: '#tokens_s-price' })
    await user.clear(priceInput)
    await user.type(priceInput, '3.49')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ ...SETTINGS, tokens_s: { tokens: 20, price_cents: 349 } })
  })

  it('saves changed ads-removal price, signup bonus and package token count together', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(
        init?.method === 'PUT'
          ? {
              ...SETTINGS,
              price_ads_removed_cents: 799,
              signup_bonus_tokens: 3,
              tokens_s: { tokens: 15, price_cents: 299 },
            }
          : SETTINGS,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    const adsPrice = screen.getByLabelText('Werbefrei, einmalig (€)')
    await user.clear(adsPrice)
    await user.type(adsPrice, '7.99')
    const bonus = screen.getByLabelText('Geschenkte Tokens bei Anmeldung')
    await user.clear(bonus)
    await user.type(bonus, '3')
    const tokensS = screen.getByLabelText('Tokens', { selector: '#tokens_s-tokens' })
    await user.clear(tokensS)
    await user.type(tokensS, '15')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(await screen.findByText('Gespeichert.')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      ...SETTINGS,
      price_ads_removed_cents: 799,
      signup_bonus_tokens: 3,
      tokens_s: { tokens: 15, price_cents: 299 },
    })
  })

  it('rejects a blank field without calling the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => jsonResponse(SETTINGS))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    const input = await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(screen.getByText('Bitte bei jedem Feld eine gültige, nicht-negative Zahl eingeben.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1) // only the initial load
  })

  it('shows an error when loading or saving fails', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PUT' ? jsonResponse({}, 500) : jsonResponse(SETTINGS),
      ),
    )
    renderPage()
    await screen.findByLabelText('KI-Prüfungen pro Woche (Standard)')
    await user.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(await screen.findByText('Die Einstellungen konnten nicht gespeichert werden.')).toBeInTheDocument()
  })

  it('shows an error when the settings cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 500)),
    )
    renderPage()
    expect(await screen.findByText('Die Einstellungen konnten nicht geladen werden.')).toBeInTheDocument()
  })
})
