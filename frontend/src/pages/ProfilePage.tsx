import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import type { User } from '../api/types'
import { Band, Columns } from '../components/Bands'
import { ExamStatsPanel } from '../components/ExamStatsPanel'
import { formStyles } from '../components/formStyles'
import { PageLayout } from '../components/PageLayout'
import { ProgressOverview } from '../components/ProgressOverview'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { useProgressSummary } from '../hooks/useProgressSummary'
import { GENDER_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'
import { formatDate, getDisplayName } from '../format'

type EmailChangeStep = 'email' | 'code'

export function ProfilePage() {
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

  // E-Mail-Adresse ändern
  const [emailStep, setEmailStep] = useState<EmailChangeStep>('email')
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
        setEmailStep('email')
        setNewEmail('')
        setEmailCode('')
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

  const dark = formStyles('dark')
  const light = formStyles('light')
  const successClass = 'text-sm text-surface'

  return (
    <PageLayout
      title="Profil"
      subtitle={
        <>
          Angemeldet als <span className="font-mono text-surface">{getDisplayName(user)}</span> · Mitglied seit{' '}
          {formatDate(user.created_at)}
        </>
      }
      bands
    >
      <Band className="pt-10 pb-16">
        {/* Keyed on exam_variant so a change refetches the Lernstand for
            the new variant's subjects. */}
        <ProfileProgress key={user.exam_variant ?? 'none'} />
      </Band>

      <Band className="pt-0 pb-16">
        <ExamStatsPanel />
      </Band>

      <Band tone="dark" className="py-14">
        <h2 className="font-serif text-3xl">Dein Konto</h2>
        <p className="mt-3 max-w-xl text-sm text-surface-alt">
          Deine persönlichen Angaben und die E-Mail-Adresse, mit der du dich anmeldest.
        </p>
      </Band>

      <Band tone="primary">
        <Columns className="sm:grid-cols-2 sm:gap-12">
          <section className="flex flex-col gap-6">
            <h3 className="font-serif text-2xl">Persönliche Daten</h3>
            <form className="flex flex-col gap-4" onSubmit={handleSavePersonalInfo}>
              <label className={dark.label} htmlFor="first-name">
                Vorname
                <input
                  id="first-name"
                  type="text"
                  maxLength={128}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className={dark.input}
                />
              </label>
              <label className={dark.label} htmlFor="last-name">
                Nachname
                <input
                  id="last-name"
                  type="text"
                  maxLength={128}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={dark.input}
                />
              </label>
              <label className={dark.label} htmlFor="gender">
                Geschlecht
                <select
                  id="gender"
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  className={dark.input}
                >
                  <option value="">Keine Angabe</option>
                  {(Object.entries(GENDER_LABELS) as [string, string][]).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {personalInfoAction.error ? <p className={dark.error}>{personalInfoAction.error}</p> : null}
              {personalInfoSuccess ? <p className={successClass}>{personalInfoSuccess}</p> : null}
              <button type="submit" disabled={personalInfoAction.isPending} className={dark.button}>
                Speichern
              </button>
            </form>
          </section>

          <section className="flex flex-col gap-6">
            <h3 className="font-serif text-2xl">E-Mail-Adresse ändern</h3>
            <p className="text-sm text-surface-alt">
              Aktuelle E-Mail-Adresse: <span className="font-mono text-surface">{user.email}</span>
            </p>
            {emailStep === 'email' ? (
              <form className="flex flex-col gap-4" onSubmit={handleRequestEmailChange}>
                <label className={dark.label} htmlFor="new-email">
                  Neue E-Mail-Adresse
                  <input
                    id="new-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    className={dark.input}
                  />
                </label>
                <p className={`text-xs ${dark.note}`}>Wir senden dir einen Bestätigungscode an die neue Adresse.</p>
                {emailAction.error ? <p className={dark.error}>{emailAction.error}</p> : null}
                {emailSuccess ? <p className={successClass}>{emailSuccess}</p> : null}
                <button type="submit" disabled={emailAction.isPending} className={dark.button}>
                  Code anfordern
                </button>
              </form>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={handleVerifyEmailChange}>
                <p className="text-sm text-surface-alt">Code gesendet an {newEmail}.</p>
                <label className={dark.label} htmlFor="email-change-code">
                  Bestätigungscode
                  <input
                    id="email-change-code"
                    type="text"
                    inputMode="numeric"
                    required
                    value={emailCode}
                    onChange={(event) => setEmailCode(event.target.value)}
                    className={`${dark.input} font-mono`}
                  />
                </label>
                {emailAction.error ? <p className={dark.error}>{emailAction.error}</p> : null}
                <button type="submit" disabled={emailAction.isPending} className={dark.button}>
                  Bestätigen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailStep('email')
                    setEmailCode('')
                    emailAction.setError(null)
                  }}
                  className={dark.link}
                >
                  Andere E-Mail-Adresse verwenden
                </button>
              </form>
            )}
          </section>
        </Columns>
      </Band>

      <Band>
        <section className="flex max-w-xl flex-col gap-4">
          <h2 className="font-serif text-2xl text-danger">Konto löschen</h2>
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
        </section>
      </Band>
    </PageLayout>
  )
}

// Lernstand overview for the profile — same three columns as /learn, with a
// link there for the per-topic details.
function ProfileProgress() {
  const { isLoading, error, totals, categories } = useProgressSummary()

  return (
    <div className="flex flex-col gap-8">
      <ProgressOverview totals={totals} categories={categories} />
      {isLoading ? <p className="text-sm text-ink-soft">Lernstand wird geladen…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Link to="/learn" className="self-start font-mono text-xs tracking-wide text-primary uppercase hover:underline">
        Alle Themen ansehen →
      </Link>
    </div>
  )
}
