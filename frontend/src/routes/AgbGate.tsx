import { useEffect } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { User } from '../api/types'
import { AGB_VERSION } from '../legal'
import { useAuthStore } from '../store/authStore'
import { useAsyncAction } from '../hooks/useAsyncAction'

// Sits inside ProtectedRoute (only reached once authenticated). The protected
// page always renders (via Outlet) so the app doesn't visually disappear;
// when the account's stored AGB version doesn't match the current one — a
// fresh acceptance, or AGB_VERSION was bumped since the last login — a modal
// overlay blocks it until confirmed. No per-login checkbox: friction only
// when a confirmation is actually owed.
export function AgbGate() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { run, isPending: isSubmitting, error } = useAsyncAction()

  const needsAcceptance = user !== null && user.agb_accepted_version !== AGB_VERSION

  // Mandatory dialog: block scrolling/interacting with the page behind it
  // for as long as it's up.
  useEffect(() => {
    if (!needsAcceptance) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [needsAcceptance])

  function handleAccept() {
    return run(
      async () => setUser(await apiClient.post<User>('/auth/me/agb-accept')),
      'Das hat nicht geklappt. Bitte erneut versuchen.',
    )
  }

  return (
    <>
      <Outlet />
      {needsAcceptance ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agb-gate-title"
            className="flex w-full max-w-md flex-col gap-4 rounded-tile border border-ink bg-surface p-6 text-center shadow-xl"
          >
            <h2 id="agb-gate-title" className="font-serif text-xl text-primary">
              Aktualisierte Nutzungsbedingungen
            </h2>
            <p className="text-ink-soft">
              Bitte bestätige, dass du unsere{' '}
              <Link to="/agb" className="text-primary underline">
                AGB
              </Link>{' '}
              akzeptierst, um SKS Lotse weiter zu nutzen.
            </p>
            {error ? (
              <p role="alert" className="rounded-tile bg-danger px-3 py-2 text-sm text-surface">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={isSubmitting}
              className="rounded-tile bg-accent px-4 py-3 font-mono text-sm tracking-wide text-surface uppercase transition hover:bg-ink disabled:opacity-60"
            >
              Ich akzeptiere die AGB
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
