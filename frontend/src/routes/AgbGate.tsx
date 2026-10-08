import { useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { User } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { buttonClass } from '../components/buttonStyles'
import { ErrorMessage } from '../components/Messages'
import { Modal } from '../components/Modal'

// Wraps the logged-in routes and the pages open to guests too (/learn, ADR-0054); it only ever
// asks a logged-in learner. The page always renders (via Outlet) so the app doesn't visually disappear;
// when the backend says the account owes a confirmation — a fresh acceptance, or the AGB version
// was bumped since the last login — a modal dialog blocks it until confirmed (the page behind it is
// inert meanwhile, see Modal). No per-login checkbox: friction only when a confirmation is actually
// owed.
export function AgbGate() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { run, isPending: isSubmitting, error } = useAsyncAction()

  const needsAcceptance = user?.needs_agb_acceptance === true
  const headingRef = useRef<HTMLHeadingElement>(null)

  function handleAccept() {
    return run(
      async () => setUser(await apiClient.post<User>('/auth/me/agb-accept')),
      'Das hat nicht geklappt. Bitte erneut versuchen.',
    )
  }

  // Mandatory: no onClose, so neither Escape nor a click beside it closes the dialog. Focus starts
  // on the heading, so a screen reader reads the dialog from its title on.
  return (
    <>
      <Outlet />
      {needsAcceptance ? (
        <Modal labelledBy="agb-gate-title" initialFocusRef={headingRef} className="text-center">
          <h2
            id="agb-gate-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-serif text-xl text-primary outline-none"
          >
            Aktualisierte Nutzungsbedingungen
          </h2>
          <p className="text-ink-soft">
            Bitte bestätige, dass du unsere{' '}
            <Link to="/terms" className="text-primary underline">
              AGB
            </Link>{' '}
            akzeptierst, um SKS Lotse weiter zu nutzen.
          </p>
          <ErrorMessage>{error}</ErrorMessage>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={isSubmitting}
            className={buttonClass('primary')}
          >
            Ich akzeptiere die AGB
          </button>
        </Modal>
      ) : null}
    </>
  )
}
