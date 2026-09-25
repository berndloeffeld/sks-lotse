import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { BALANCE_RECHECK_MS, PricingPage } from './PricingPage'
import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeUser } from '../test/fixtures'

const PRICING = {
  ads_removed_price_cents: 500,
  signup_bonus_tokens: 6,
  packages: [
    { product: 'tokens_s', tokens: 20, price_cents: 299 },
    { product: 'tokens_m', tokens: 50, price_cents: 599 },
    { product: 'tokens_l', tokens: 100, price_cents: 999 },
    { product: 'tokens_xl', tokens: 200, price_cents: 1699 },
  ],
  checkout_enabled: false,
}

const BUYER = makeUser({ token_balance: 3, can_buy_tokens: true })

function renderPage(path = '/pricing') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PricingPage />
    </MemoryRouter>,
  )
}

// Answers GET /pricing, and each other request with the next of `responses`.
function stubFetch(pricing: object, ...responses: Response[]) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/pricing')) return jsonResponse(pricing)
    return responses.shift() ?? jsonResponse({}, 500)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('PricingPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows every package with its price, no buy button, and the preview notice', async () => {
    stubFetch(PRICING)
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

  it('asks a logged-out visitor to log in once the checkout is open to everyone', async () => {
    stubFetch({ ...PRICING, checkout_enabled: true })
    renderPage()

    expect(await screen.findByRole('link', { name: 'Melde dich an' })).toHaveAttribute('href', '/login')
    // Only Werbefrei is still "coming soon".
    expect(screen.getAllByText('Bald verfügbar')).toHaveLength(1)
    expect(screen.queryByText(/noch nicht möglich/)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('lets an account that may buy pick a package and go to Stripe', async () => {
    useAuthStore.setState({ user: BUYER })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const fetchMock = stubFetch(PRICING, jsonResponse({ url: 'https://checkout.stripe.com/c/pay/cs_1' }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Dein Stand: 3 Tokens/)).toBeInTheDocument()
    expect(screen.getAllByText('Bald verfügbar')).toHaveLength(1)
    const buy = screen.getByRole('button', { name: 'Paket kaufen' })

    await user.click(buy)
    expect(screen.getByRole('alert')).toHaveTextContent('Wähle zuerst ein Paket.')

    await user.click(screen.getByRole('radio', { name: /Paket M/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Paket M für 5,99\s€ kaufen/ }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Zustimmung zur sofortigen Bereitstellung/)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('checkbox', { name: /Widerrufsrecht/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Paket M für 5,99\s€ kaufen/ }))

    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/payments\/checkout$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ product: 'tokens_m', waive_withdrawal: true })
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_1')
  })

  it.each([
    [403, 'Der Kauf ist gerade nicht möglich.'],
    [502, 'Die Zahlung konnte nicht gestartet werden. Versuche es später noch einmal.'],
  ])('explains a failed checkout (%i)', async (status, message) => {
    useAuthStore.setState({ user: BUYER })
    stubFetch(PRICING, jsonResponse({ detail: 'nope' }, status))
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: /Paket S/ }))
    await user.click(screen.getByRole('checkbox', { name: /Widerrufsrecht/ }))
    await user.click(screen.getByRole('button', { name: /Paket S für 2,99\s€ kaufen/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('thanks the buyer after the payment and fetches the balance again a little later', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    useAuthStore.setState({ user: BUYER })
    const fetchMock = stubFetch(
      PRICING,
      jsonResponse({ ...BUYER, token_balance: 3 }),
      jsonResponse({ ...BUYER, token_balance: 23 }),
    )
    renderPage('/pricing?checkout=success')

    expect(screen.getByRole('status')).toHaveTextContent('Danke für deinen Kauf!')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BALANCE_RECHECK_MS)
    })
    expect(screen.getByRole('status')).toHaveTextContent('aktueller Stand: 23 Tokens')
    const meCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me'))
    expect(meCalls).toHaveLength(2)
  })

  it('keeps quiet about the balance after a payment when the session is gone', async () => {
    const fetchMock = stubFetch(PRICING)
    renderPage('/pricing?checkout=success')

    expect(screen.getByRole('status')).toHaveTextContent('Die Tokens werden deinem Konto gutgeschrieben.')
    await screen.findByText('5,00 €')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/me'))).toHaveLength(0)
  })

  it('ignores a failed balance refresh', async () => {
    useAuthStore.setState({ user: BUYER })
    stubFetch(PRICING, jsonResponse({}, 500))
    renderPage('/pricing?checkout=success')

    await screen.findByText('5,00 €')
    expect(screen.getByRole('status')).toHaveTextContent('aktueller Stand: 3 Tokens')
  })

  it('says nothing was charged after a cancelled checkout', async () => {
    stubFetch(PRICING)
    renderPage('/pricing?checkout=cancelled')

    expect(screen.getByRole('status')).toHaveTextContent('Zahlung abgebrochen – es wurde nichts berechnet.')
    await screen.findByText('5,00 €')
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
