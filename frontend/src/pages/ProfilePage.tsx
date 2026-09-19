import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, apiClient } from '../api/client'
import { getDisplayName, type User } from '../api/types'
import { ExamVariantDropdown } from '../components/ExamVariantDropdown'
import { PageLayout } from '../components/PageLayout'
import { ProgressSummarySection } from '../components/ProgressSummarySection'
import { useExamVariantUpdate } from '../hooks/useExamVariantUpdate'
import { GENDER_LABELS } from '../labels'
import { useAuthStore } from '../store/authStore'

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
  const [isSavingPersonalInfo, setIsSavingPersonalInfo] = useState(false)
  const [personalInfoError, setPersonalInfoError] = useState<string | null>(null)
  const [personalInfoSuccess, setPersonalInfoSuccess] = useState<string | null>(null)

  // Prüfungsziel
  const { changeVariant, isSaving: isSavingVariant, error: variantError } = useExamVariantUpdate()

  // E-Mail-Adresse ändern
  const [emailStep, setEmailStep] = useState<EmailChangeStep>('email')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)

  // Konto löschen
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
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
    setPersonalInfoError(null)
    setPersonalInfoSuccess(null)
    setIsSavingPersonalInfo(true)
    try {
      await updateUser({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        gender: gender || null,
      })
      setPersonalInfoSuccess('Gespeichert.')
    } catch {
      setPersonalInfoError('Die Angaben konnten nicht gespeichert werden.')
    } finally {
      setIsSavingPersonalInfo(false)
    }
  }

  async function handleRequestEmailChange(event: FormEvent) {
    event.preventDefault()
    setEmailError(null)
    setEmailSuccess(null)
    // Caught here rather than via the backend's 400, which this page can't
    // tell apart from the disposable-address 400 below by status alone.
    if (user && newEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      setEmailError('Das ist bereits deine E-Mail-Adresse.')
      return
    }
    setIsSubmittingEmail(true)
    try {
      await apiClient.post('/auth/me/email/request', { new_email: newEmail })
      setEmailStep('code')
    } catch (err) {
      setEmailError(
        err instanceof ApiError && err.status === 409
          ? 'Diese E-Mail-Adresse wird bereits verwendet.'
          : err instanceof ApiError && err.status === 403
            ? 'Mit dieser E-Mail-Adresse ist derzeit keine Anmeldung möglich.'
            : err instanceof ApiError && err.status === 400
              ? 'Wegwerf-E-Mail-Adressen werden nicht unterstützt.'
              : 'Der Code konnte nicht angefordert werden.',
      )
    } finally {
      setIsSubmittingEmail(false)
    }
  }

  async function handleVerifyEmailChange(event: FormEvent) {
    event.preventDefault()
    setEmailError(null)
    setIsSubmittingEmail(true)
    try {
      setUser(await apiClient.post<User>('/auth/me/email/verify', { new_email: newEmail, code: emailCode }))
      setEmailStep('email')
      setNewEmail('')
      setEmailCode('')
      setEmailSuccess('E-Mail-Adresse geändert.')
    } catch (err) {
      setEmailError(
        err instanceof ApiError && err.status === 409
          ? 'Diese E-Mail-Adresse wird bereits verwendet.'
          : 'Der Code ist ungültig oder abgelaufen.',
      )
    } finally {
      setIsSubmittingEmail(false)
    }
  }

  const canConfirmDelete = deleteConfirmEmail.trim().toLowerCase() === user.email.toLowerCase()

  async function handleDeleteAccount(event: FormEvent) {
    event.preventDefault()
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await apiClient.delete('/auth/me')
      // Not logout(): the backend already dropped the account and cleared the
      // cookie, so POST /auth/logout could only 401. The local session is
      // cleared by the effect above once this navigation lands.
      setIsAccountDeleted(true)
      navigate('/', { replace: true })
    } catch {
      setDeleteError('Der Account konnte nicht gelöscht werden.')
      setIsDeleting(false)
    }
  }

  return (
    <PageLayout
      title="Profil"
      backTo="/start"
      subtitle={
        <>
          Angemeldet als <span className="font-mono text-surface">{getDisplayName(user)}</span> · Mitglied seit{' '}
          {new Date(user.created_at).toLocaleDateString('de-DE')}
        </>
      }
    >
      <section className="flex flex-col gap-4 border border-border p-4">
        <h2 className="font-serif text-lg text-ink">Persönliche Daten</h2>
        <form className="flex flex-col gap-4" onSubmit={handleSavePersonalInfo}>
          <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="first-name">
            Vorname
            <input
              id="first-name"
              type="text"
              maxLength={128}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="border border-border bg-surface px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="last-name">
            Nachname
            <input
              id="last-name"
              type="text"
              maxLength={128}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="border border-border bg-surface px-3 py-2 text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="gender">
            Geschlecht
            <select
              id="gender"
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="border border-border bg-surface px-3 py-2 text-ink"
            >
              <option value="">Keine Angabe</option>
              {(Object.entries(GENDER_LABELS) as [string, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {personalInfoError ? <p className="text-sm text-danger">{personalInfoError}</p> : null}
          {personalInfoSuccess ? <p className="text-sm text-ink">{personalInfoSuccess}</p> : null}
          <button
            type="submit"
            disabled={isSavingPersonalInfo}
            className="border border-ink bg-ink px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
          >
            Speichern
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4 border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-lg text-ink">Prüfungsziel</h2>
          <ExamVariantDropdown value={user.exam_variant} onChange={changeVariant} disabled={isSavingVariant} />
        </div>
        {variantError ? <p className="text-sm text-danger">{variantError}</p> : null}
      </section>

      <ProgressSummarySection key={user.exam_variant ?? 'none'} />

      <section className="flex flex-col gap-4 border border-border p-4">
        <h2 className="font-serif text-lg text-ink">E-Mail-Adresse ändern</h2>
        <p className="text-sm text-ink-soft">
          Aktuelle E-Mail-Adresse: <span className="font-mono text-ink">{user.email}</span>
        </p>
        {emailStep === 'email' ? (
          <form className="flex flex-col gap-4" onSubmit={handleRequestEmailChange}>
            <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="new-email">
              Neue E-Mail-Adresse
              <input
                id="new-email"
                type="email"
                required
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                className="border border-border bg-surface px-3 py-2 text-ink"
              />
            </label>
            {emailError ? <p className="text-sm text-danger">{emailError}</p> : null}
            {emailSuccess ? <p className="text-sm text-ink">{emailSuccess}</p> : null}
            <button
              type="submit"
              disabled={isSubmittingEmail}
              className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
            >
              Code anfordern
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleVerifyEmailChange}>
            <p className="text-sm text-ink-soft">Code gesendet an {newEmail}.</p>
            <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="email-change-code">
              Bestätigungscode
              <input
                id="email-change-code"
                type="text"
                inputMode="numeric"
                required
                value={emailCode}
                onChange={(event) => setEmailCode(event.target.value)}
                className="border border-border bg-surface px-3 py-2 font-mono text-ink"
              />
            </label>
            {emailError ? <p className="text-sm text-danger">{emailError}</p> : null}
            <button
              type="submit"
              disabled={isSubmittingEmail}
              className="border border-ink px-4 py-2 font-mono text-sm tracking-wide text-ink uppercase hover:bg-surface-alt disabled:opacity-60"
            >
              Bestätigen
            </button>
            <button
              type="button"
              onClick={() => {
                setEmailStep('email')
                setEmailCode('')
                setEmailError(null)
              }}
              className="text-primary text-sm underline"
            >
              Andere E-Mail-Adresse verwenden
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2 border border-danger p-4">
        <h2 className="font-serif text-lg text-ink">Konto löschen</h2>
        <p className="text-sm text-ink-soft">
          Dein Account und dein gesamter Lernfortschritt werden unwiderruflich gelöscht.
        </p>
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-danger px-4 py-2 font-mono text-sm tracking-wide text-danger uppercase hover:bg-surface-alt"
          >
            Account löschen
          </button>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleDeleteAccount}>
            <label className="flex flex-col gap-1 text-sm text-ink-soft" htmlFor="delete-confirm-email">
              Zur Bestätigung E-Mail-Adresse erneut eingeben: {user.email}
              <input
                id="delete-confirm-email"
                type="email"
                value={deleteConfirmEmail}
                onChange={(event) => setDeleteConfirmEmail(event.target.value)}
                className="border border-border bg-surface px-3 py-2 text-ink"
              />
            </label>
            {deleteError ? <p className="text-sm text-danger">{deleteError}</p> : null}
            <button
              type="submit"
              disabled={!canConfirmDelete || isDeleting}
              className="border border-danger bg-danger px-4 py-2 font-mono text-sm tracking-wide text-surface uppercase disabled:opacity-60"
            >
              Endgültig löschen
            </button>
          </form>
        )}
      </section>
    </PageLayout>
  )
}
