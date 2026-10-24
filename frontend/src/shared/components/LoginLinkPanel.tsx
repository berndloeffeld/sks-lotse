import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { trackEvent } from '../analytics'
import { ApiError, apiClient } from '../api/client'
import { buttonClass } from './buttonStyles'
import { ErrorMessage } from './Messages'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { siteIdentity } from '../siteConfig'
import { useAuthStore } from '../store/authStore'

// The token from the login link in the code email: /login/link#t=<token> (ADR-0064). In the
// fragment, so it never reaches a server log, a Referer header or the analytics.
function linkTokenFrom(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('t') || null
}

// What /login/link shows, on both sites (each wraps it in its page): where the login link in the
// code email lands. It signs in only on the learner's click, never on its own: mail scanners open
// links to check them, and would use the link up before the learner gets here.
export function LoginLinkPanel() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const checkSession = useAuthStore((state) => state.checkSession)
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => linkTokenFrom(location.hash))
  const { run, isPending, error } = useAsyncAction()

  // Out of the address bar and the browser history right away; the token lives on in state only.
  // Not when already signed in: the redirect below replaces this entry anyway, and this one would
  // race it back here.
  useEffect(() => {
    if (location.hash && !isAuthenticated) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true })
    }
  }, [isAuthenticated, location.hash, location.pathname, location.search, navigate])

  // Signed in — by this link (the redirect that follows the click), or already before it.
  if (isAuthenticated) {
    return <Navigate to={siteIdentity().afterLogin} replace />
  }

  async function signIn() {
    await run(
      async () => {
        await apiClient.post('/auth/otp/verify-link', { token })
        await checkSession()
        trackEvent('login')
      },
      (err) =>
        err instanceof ApiError && (err.status === 401 || err.status === 422)
          ? 'Der Link ist ungültig, abgelaufen oder wurde schon benutzt. Fordere bitte einen neuen Code an.'
          : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
    )
  }

  return (
    <>
      {token === null ? (
        <p className="text-ink-soft">
          Dieser Anmeldelink ist unvollständig. Öffne ihn bitte direkt aus der E-Mail oder gib dort den Code ein.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-ink-soft">Du meldest dich mit der E-Mail-Adresse an, an die dieser Link ging.</p>
          <ErrorMessage>{error}</ErrorMessage>
          <button type="button" onClick={signIn} disabled={isPending} className={buttonClass('primary')}>
            Jetzt anmelden
          </button>
        </div>
      )}
      <Link to="/login" className={`${buttonClass('tertiary')} mt-4 self-start`}>
        Code eingeben oder neu anfordern
      </Link>
    </>
  )
}
