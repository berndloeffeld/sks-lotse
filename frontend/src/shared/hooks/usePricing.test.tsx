import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '../store/authStore'
import { jsonResponse, makeUser } from '../../test/fixtures'
import { BALANCE_RECHECK_MS, usePricing } from './usePricing'

const PRICING = {
  signup_bonus_tokens: 6,
  checkout_enabled: true,
  packages: [{ product: 'tokens_s', tokens: 20, price_cents: 299 }],
}

function wrapperAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  }
}

describe('usePricing', () => {
  afterEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState())
  })

  it('lets a guest look and sends them to the login once checkout is open', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(PRICING)))
    const { result } = renderHook(() => usePricing(), { wrapper: wrapperAt('/pricing') })

    await waitFor(() => expect(result.current.data).toEqual(PRICING))
    expect(result.current).toMatchObject({ canBuy: false, loginToBuy: true, tokensSoon: false, checkout: null })
  })

  it('says "bald" while nobody can buy yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...PRICING, checkout_enabled: false })))
    const { result } = renderHook(() => usePricing(), { wrapper: wrapperAt('/pricing') })

    await waitFor(() => expect(result.current.tokensSoon).toBe(true))
    expect(result.current.loginToBuy).toBe(false)
  })

  it('reads the package just bought from the return of Stripe, for an account that can buy', async () => {
    useAuthStore.setState({ user: makeUser({ can_buy_tokens: true }), isAuthenticated: true, isLoading: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(PRICING)))
    const { result } = renderHook(() => usePricing(), {
      wrapper: wrapperAt('/pricing?checkout=success&product=tokens_s'),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current).toMatchObject({ canBuy: true, checkout: 'success', boughtProduct: 'tokens_s' })
  })

  it('knows no package after a cancelled payment', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(PRICING)))
    const { result } = renderHook(() => usePricing(), { wrapper: wrapperAt('/pricing?checkout=cancelled&product=x') })

    expect(result.current).toMatchObject({ checkout: 'cancelled', boughtProduct: null })
  })

  it('rechecks the balance a few seconds after the return', () => {
    expect(BALANCE_RECHECK_MS).toBe(5000)
  })
})
