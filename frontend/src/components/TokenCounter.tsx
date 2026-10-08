import { Link, useSearchParams } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { HelmIcon } from './icons/FeatureIcons'

// Below this many tokens the counter turns red: only a handful of Lotsen-Checks are left.
const LOW_TOKEN_THRESHOLD = 5

// The header's token balance: the ship's wheel (the Lotsen-Check's symbol, HelmIcon) and the number, nothing else. Links to the token packages.
// Green while `/pricing?checkout=success` is showing (the learner just bought tokens), red below
// LOW_TOKEN_THRESHOLD, otherwise the same outline as the other header buttons. A pill, unlike them:
// a counter, not a button (an exception ADR-0014's addendum of 2026-10-08 records).
export function TokenCounter() {
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  if (!user) return null

  const justBought = searchParams.get('checkout') === 'success'
  const tone = justBought
    ? 'border-success bg-success text-surface'
    : user.token_balance < LOW_TOKEN_THRESHOLD
      ? 'border-danger bg-danger text-surface'
      : 'border-surface text-surface hover:bg-surface hover:text-primary-dark'

  return (
    <Link
      to="/pricing"
      aria-label={`${user.token_balance} Tokens – zum Shop`}
      className={`inline-flex items-baseline gap-1.5 rounded-full border-2 px-3 py-2 font-mono text-xs transition ${tone}`}
    >
      <HelmIcon className="size-4 self-center" />
      {user.token_balance}
    </Link>
  )
}
