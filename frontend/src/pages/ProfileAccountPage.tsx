import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { User } from '../api/types'
import { Band } from '../components/Bands'
import { formStyles } from '../components/formStyles'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { GENDER_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'

type EmailChangeStep = 'view' | 'email' | 'code'

const light = formStyles('light')

// A settings section in the same voice as the Lernstand tab's columns
// (ProgressOverview): a colored serif heading, no box around it. Sections
// after the first get a hairline top divider instead of a border all round —
// softer than a bordered card, still separates the stack.
function Section({
  title,
  danger = false,
  divider = true,
  children,
}: {
  title: string
  danger?: boolean
  divider?: boolean
  children: ReactNode
}) {
  return (
    <section className={`flex flex-col gap-4 ${divider ? 'border-t border-border pt-10' : ''}`}>
      <h2 className={`font-serif text-2xl ${danger ? 'text-danger' : 'text-primary'}`}>{title}</h2>
      {children}
    </section>
  )
}

// /profile's "Konto" tab: token balance, then the account settings
// (personal data, email, delete). Styled after the Lernstand tab right next
// to it — plain sections on the page background, not boxed-in cards.
export function ProfileAccountPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const updateUser = useAuthStore((state) => state.updateUser)
  const clearSession = useAuthStore((state) => state.clearSession)

  // Personal info (Vorname/Nachname/Geschlecht)
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [gender, setGender] = useState(user?.gender ?? '')
  const personalInfoAction = useAsyncAction()
  const [personalInfoSuccess, setPersonalInfoSuccess] = useState<string | null>(null)

  // E-Mail-Adresse ändern — collapsed behind "Ändern" until opened, so the
  // section's resting state is just the current address.
  const [emailStep, setEmailStep] = useState<EmailChangeStep>('view')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const emailAction = useAsyncAction()
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  // Konto löschen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const deleteAction = useAsyncAction()
  const [isAccountDeleted, setIsAccountDeleted] = useState(false)

  // Once the account is gone, clear the (already dead) session only when this
  // page actually leaves the tree — i.e. after the navigation to "/" below has
  // committed. Clearing it any earlier re-renders ProtectedRoute first (store
  // updates render synchronously, React Router navigations as a transition),
  // and its redirect to /login would win over the navigation to "/".
  useEffect(() => {
    if (!isAccountDeleted) return
    return clearSession
  }, [isAccountDeleted, clearSession])

  if (!user) {
    return null
  }

  function closeEmailEditor() {
    setEmailStep('view')
    setNewEmail('')
    setEmailCode('')
    emailAction.setError(null)
  }

  async function handleSavePersonalInfo(event: FormEvent) {
    event.preventDefault()
    setPersonalInfoSuccess(null)
    await personalInfoAction.run(async () => {
      await updateUser({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        gender: gender || null,
      })
      setPersonalInfoSuccess('Gespeichert.')
    }, 'Die Angaben konnten nicht gespeichert werden.')
  }

  async function handleRequestEmailChange(event: FormEvent) {
    event.preventDefault()
    setEmailSuccess(null)
    // Caught here rather than via the backend's 400, which this page can't
    // tell apart from the disposable-address 400 below by status alone.
    if (user && newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      emailAction.setError('Das ist bereits deine E-Mail-Adresse.')
      return
    }
    await emailAction.run(
      async () => {
        await apiClient.post('/auth/me/email/request', { new_email: newEmail })
        setEmailStep('code')
      },
      (err) =>
        err instanceof ApiError && err.status === 409
          ? 'Diese E-Mail-Adresse wird bereits verwendet.'
          : err instanceof ApiError && err.status === 403
            ? 'Mit dieser E-Mail-Adresse ist derzeit keine Anmeldung möglich.'
            : err instanceof ApiError && err.status === 400
              ? 'Wegwerf-E-Mail-Adressen werden nicht unterstützt.'
              : 'Der Code konnte nicht angefordert werden.',
    )
  }

  async function handleVerifyEmailChange(event: FormEvent) {
    event.preventDefault()
    await emailAction.run(
      async () => {
        setUser(await apiClient.post<User>('/auth/me/email/verify', { new_email: newEmail, code: emailCode }))
        closeEmailEditor()
        setEmailSuccess('E-Mail-Adresse geändert.')
      },
      (err) =>
        err instanceof ApiError && err.status === 409
          ? 'Diese E-Mail-Adresse wird bereits verwendet.'
          : 'Der Code ist ungültig oder abgelaufen.',
    )
  }

  const canConfirmDelete = deleteConfirmEmail.trim().toLowerCase() === user.email.toLowerCase()

  async function handleDeleteAccount(event: FormEvent) {
    event.preventDefault()
    await deleteAction.run(async () => {
      await apiClient.delete('/auth/me')
      // Not logout(): the backend already dropped the account and cleared the
      // cookie, so POST /auth/logout could only 401. The local session is
      // cleared by the effect above once this navigation lands.
      setIsAccountDeleted(true)
      navigate('/', { replace: true })
    }, 'Der Account konnte nicht gelöscht werden.')
  }

  return (
    <Band className="pt-10 pb-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <p className="text-sm text-ink-soft">
          Dein Token-Stand: <span className="font-mono text-ink">{user.token_balance}</span>
          {user.can_buy_tokens ? (
            <>
              {' · '}
              <Link to="/pricing" className="underline hover:text-ink">
                Tokens im Shop kaufen
              </Link>
            </>
          ) : null}
        </p>

        <Section title="Persönliche Daten" divider={false}>
          <form className="flex flex-col gap-4" onSubmit={handleSavePersonalInfo}>
            <label className={light.label} htmlFor="first-name">
              Vorname
              <input
                id="first-name"
                type="text"
                maxLength={128}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={light.input}
              />
            </label>
            <label className={light.label} htmlFor="last-name">
              Nachname
              <input
                id="last-name"
                type="text"
                maxLength={128}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={light.input}
              />
            </label>
            <label className={light.label} htmlFor="gender">
              Geschlecht
              <select
                id="gender"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                className={light.input}
              >
                <option value="">Keine Angabe</option>
                {(Object.entries(GENDER_LABELS) as [string, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {personalInfoAction.error ? <p className={light.error}>{personalInfoAction.error}</p> : null}
            {personalInfoSuccess ? <p className="text-sm text-ink">{personalInfoSuccess}</p> : null}
            <button type="submit" disabled={personalInfoAction.isPending} className={light.button}>
              Speichern
            </button>
          </form>
        </Section>

        <Section title="E-Mail-Adresse">
          <p className="text-sm text-ink-soft">
            Aktuelle Adresse: <span className="font-mono text-ink">{user.email}</span>
          </p>
          {emailSuccess ? <p className="text-sm text-ink">{emailSuccess}</p> : null}
          {emailStep === 'view' ? (
            <button type="button" onClick={() => setEmailStep('email')} className="self-start text-sm underline">
              E-Mail-Adresse ändern
            </button>
          ) : emailStep === 'email' ? (
            <form className="flex flex-col gap-4" onSubmit={handleRequestEmailChange}>
              <label className={light.label} htmlFor="new-email">
                Neue E-Mail-Adresse
                <input
                  id="new-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  className={light.input}
                />
              </label>
              <p className={`text-xs ${light.note}`}>Wir senden dir einen Bestätigungscode an die neue Adresse.</p>
              {emailAction.error ? <p className={light.error}>{emailAction.error}</p> : null}
              <div className="flex items-center gap-4">
                <button type="submit" disabled={emailAction.isPending} className={light.button}>
                  Code anfordern
                </button>
                <button type="button" onClick={closeEmailEditor} className={light.link}>
                  Abbrechen
                </button>
              </div>
            </form>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleVerifyEmailChange}>
              <p className="text-sm text-ink-soft">Code gesendet an {newEmail}.</p>
              <label className={light.label} htmlFor="email-change-code">
                Bestätigungscode
                <input
                  id="email-change-code"
                  type="text"
                  inputMode="numeric"
                  required
                  value={emailCode}
                  onChange={(event) => setEmailCode(event.target.value)}
                  className={`${light.input} font-mono`}
                />
              </label>
              {emailAction.error ? <p className={light.error}>{emailAction.error}</p> : null}
              <div className="flex items-center gap-4">
                <button type="submit" disabled={emailAction.isPending} className={light.button}>
                  Bestätigen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailStep('email')
                    setEmailCode('')
                    emailAction.setError(null)
                  }}
                  className={light.link}
                >
                  Andere E-Mail-Adresse verwenden
                </button>
              </div>
            </form>
          )}
        </Section>

        <Section title="Konto löschen" danger>
          <p className="text-sm leading-relaxed text-ink-soft">
            Dein Account und dein gesamter Lernfortschritt werden unwiderruflich gelöscht.
          </p>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="self-start rounded-tile border-2 border-danger px-4 py-3 font-mono text-sm tracking-wide text-danger uppercase hover:bg-surface-alt"
            >
              Account löschen
            </button>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleDeleteAccount}>
              <label className={light.label} htmlFor="delete-confirm-email">
                Zur Bestätigung E-Mail-Adresse erneut eingeben: {user.email}
                <input
                  id="delete-confirm-email"
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(event) => setDeleteConfirmEmail(event.target.value)}
                  className={`${light.input} border-danger`}
                />
              </label>
              {deleteAction.error ? <p className={light.error}>{deleteAction.error}</p> : null}
              <button
                type="submit"
                disabled={!canConfirmDelete || deleteAction.isPending}
                className="rounded-tile bg-danger px-4 py-3 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
              >
                Endgültig löschen
              </button>
            </form>
          )}
        </Section>
      </div>
    </Band>
  )
}
