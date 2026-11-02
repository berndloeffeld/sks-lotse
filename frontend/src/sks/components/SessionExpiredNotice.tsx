import { useLocation } from 'react-router-dom'

import { useAuthStore } from '../store/authStore'
import { LoginLink } from './LoginLink'
import { buttonClass } from './buttonStyles'

// Said once a request found the learner's session gone, so the page doesn't just turn into the
// guest's without a word (authStore.sessionExpired) — on /login, where ProtectedRoute sends them,
// as on the public pages that stay. Until the next login or "Schließen".
export function SessionExpiredNotice() {
  const sessionExpired = useAuthStore((state) => state.sessionExpired)
  const dismiss = useAuthStore((state) => state.dismissSessionExpired)
  const { pathname } = useLocation()
  if (!sessionExpired) return null
  return (
    <div role="status" className="border-b border-border bg-surface-alt">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-baseline gap-x-4 gap-y-2 px-4 py-3 text-sm text-ink">
        <p>Deine Sitzung ist abgelaufen.</p>
        {pathname === '/login' ? null : <LoginLink className="text-primary underline">Anmelden</LoginLink>}
        <button type="button" onClick={dismiss} className={`${buttonClass('tertiary')} ml-auto`}>
          Schließen
        </button>
      </div>
    </div>
  )
}
