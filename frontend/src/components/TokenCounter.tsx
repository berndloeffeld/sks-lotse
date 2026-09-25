import { Link, useSearchParams } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'

// Below this many tokens the counter turns red: only a handful of Lotsen-Checks are left.
export const LOW_TOKEN_THRESHOLD = 5

// The header's token balance: a coin and the number, nothing else. Links to the token packages.
// Green while `/pricing?checkout=success` is showing (the learner just bought tokens), red below
// LOW_TOKEN_THRESHOLD, otherwise the same outline as the other header buttons.
export function TokenCounter() {
  const user = useAuthStore((s) => s.user)
  const [searchParams] = useSearchParams()
  if (!user) return null

  const justBought = searchParams.get('checkout') === 'success'
  const tone = justBought
    ? 'border-success bg-success text-white'
    : user.token_balance < LOW_TOKEN_THRESHOLD
      ? 'border-danger bg-danger text-white'
      : 'border-surface text-surface hover:bg-surface hover:text-primary-dark'

  return (
    <Link
      to="/pricing"
      aria-label={`${user.token_balance} Tokens – zum Shop`}
      className={`inline-flex items-baseline gap-1.5 rounded-full border-2 px-3 py-2 font-mono text-xs transition ${tone}`}
    >
      <svg
        className="translate-y-px"
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
      </svg>
      {user.token_balance}
    </Link>
  )
}
