import { useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { PublicPricing } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { useApiQuery } from './useApiQuery'

// How long after the return from Stripe the balance is fetched once more: the webhook that credits
// the tokens (ADR-0048) usually lands before the redirect, but isn't guaranteed to.
export const BALANCE_RECHECK_MS = 5000

const noSubscription = () => () => {}

// False while hydrating the prerendered /pricing (ADR-0025), true from then on — and from the first
// render when the page is rendered client-side. The prerender sees no query string, so whatever
// depends on it (the return from Stripe) only appears once hydration is done, never mismatching.
function useHydrated() {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
}

// What a /pricing page needs to know: the prices, whether this visitor can buy, and the return
// from Stripe (`?checkout=`, only once hydrated).
export function usePricing() {
  const { data, isLoading, failed, reload } = useApiQuery('pricing-page', () =>
    apiClient.get<PublicPricing>('/pricing'),
  )
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  const checkout = useHydrated() ? searchParams.get('checkout') : null
  const canBuy = user?.can_buy_tokens ?? false
  // Back from a paid checkout: which package was bought (`&product=`, set by the backend).
  const boughtProduct = checkout === 'success' ? searchParams.get('product') : null
  // Open to everyone, but this visitor isn't logged in (a logged-in account then has can_buy_tokens).
  const loginToBuy = !canBuy && (data?.checkout_enabled ?? false)
  // Only once the prices said so: the prerendered page (still loading) must not claim either way.
  const tokensSoon = data !== undefined && !canBuy && !loginToBuy
  return { data, isLoading, failed, reload, user, checkout, canBuy, boughtProduct, loginToBuy, tokensSoon }
}

export type Pricing = ReturnType<typeof usePricing>
