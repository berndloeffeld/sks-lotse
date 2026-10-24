import { useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { apiClient } from '../api/client'
import type { User } from '../api/types'
import { useAuthStore } from '../store/authStore'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { buttonClass } from '../components/buttonStyles'
import { ErrorMessage } from '../components/Messages'
import { Modal } from '../components/Modal'
import { HelmIcon } from '../components/icons'

// Wraps the logged-in routes and the pages open to guests too (/learn, ADR-0054); it only ever
// asks a logged-in learner. The page always renders (via Outlet) so the app doesn't visually disappear;
// when the backend says the account owes a confirmation — a fresh acceptance, or the AGB version
// was bumped since the last login — a modal dialog blocks it until confirmed (the page behind it is
// inert meanwhile, see Modal). No per-login checkbox: friction only when a confirmation is actually
// owed. An account that has never confirmed any version is new: there the dialog welcomes it and
// names the signup bonus (ADR-0043), which the header's bare counter alone doesn't make clear.
export function AgbGate() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const { run, isPending: isSubmitting, error } = useAsyncAction()

  const needsAcceptance = user?.needs_agb_acceptance === true
  const isNewAccount = user?.agb_accepted_version === null
  // A fresh account's balance is the signup bonus; none if the admin set it to 0.
  const bonusTokens = isNewAccount ? (user?.token_balance ?? 0) : 0
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
            {isNewAccount ? 'Willkommen an Bord' : 'Aktualisierte Nutzungsbedingungen'}
          </h2>
          {bonusTokens > 0 ? (
            <>
              {/* The header's token counter, so the learner finds the number there again. */}
              <span className="inline-flex items-baseline gap-1.5 self-center rounded-full border-2 border-primary px-3 py-2 font-mono text-xs text-primary">
                <HelmIcon className="size-4 self-center" />
                {bonusTokens}
              </span>
              <p>
                Zum Start schenken wir dir {bonusTokens} Tokens. Damit lässt du den Lotsen deine Antworten prüfen: 1
                Token je Katalogfrage, 2 je Aufgabe einer Kartenaufgabe.
              </p>
            </>
          ) : null}
          <p className="text-ink-soft">
            Bitte bestätige, dass du unsere{' '}
            <Link to="/terms" className="text-primary underline">
              AGB
            </Link>{' '}
            akzeptierst, um SKS Lotse {isNewAccount ? 'zu nutzen' : 'weiter zu nutzen'}.
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
