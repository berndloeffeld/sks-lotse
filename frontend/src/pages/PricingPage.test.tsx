import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { PricingPage } from './PricingPage'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const PRICING = {
  ads_removed_price_cents: 500,
  signup_bonus_tokens: 6,
  packages: [
    { product: 'tokens_s', tokens: 20, price_cents: 299 },
    { product: 'tokens_m', tokens: 50, price_cents: 599 },
    { product: 'tokens_l', tokens: 100, price_cents: 999 },
    { product: 'tokens_xl', tokens: 200, price_cents: 1699 },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>,
  )
}

describe('PricingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows every package with its price, no buy button, and the preview notice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(PRICING)),
    )
    renderPage()

    expect(screen.getByRole('heading', { name: 'Preise', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('5,00 €')).toBeInTheDocument()
    expect(screen.getByText('20 Tokens')).toBeInTheDocument()
    expect(screen.getByText('200 Tokens')).toBeInTheDocument()
    expect(screen.getByText('16,99 €')).toBeInTheDocument()
    expect(screen.getByText(/6 Tokens geschenkt/)).toBeInTheDocument()
    expect(screen.getByText(/noch nicht möglich/)).toBeInTheDocument()
    // Subtitle banner, once for Werbefrei, once per package (4) — impossible to skim past as a
    // live price list.
    expect(screen.getAllByText('Bald verfügbar')).toHaveLength(6)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an error when the prices cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 500)),
    )
    renderPage()

    expect(await screen.findByText('Die Preise konnten nicht geladen werden.')).toBeInTheDocument()
  })
})
