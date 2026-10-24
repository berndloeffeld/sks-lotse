import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { trackSignupClick, type SignupPlace } from '../../shared/analytics'
import { loginState } from '../returnPath'
import { buttonClass } from '../../shared/components/buttonStyles'

// The way to /login for a guest, from wherever they are: the login brings them back here
// afterwards (returnPath.ts). With a `place`, a click counts as an invitation taken up.
export function LoginLink({
  className,
  place,
  children,
}: {
  className?: string
  place?: SignupPlace
  children: ReactNode
}) {
  const location = useLocation()
  return (
    <Link
      to="/login"
      state={loginState(location)}
      className={className}
      onClick={place ? () => trackSignupClick(place) : undefined}
    >
      {children}
    </Link>
  )
}

// The one invitation to sign up a guest sees on the pages open to them (/learn, the Kartenaufgaben,
// /pricing, the end of a round): what an account adds, and "Kostenlos anmelden" beside it.
export function GuestCta({ place, children }: { place: SignupPlace; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-tile border border-primary bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-xl text-sm text-ink">{children}</p>
      <LoginLink place={place} className={`${buttonClass('primary')} shrink-0`}>
        Kostenlos anmelden
      </LoginLink>
    </div>
  )
}
