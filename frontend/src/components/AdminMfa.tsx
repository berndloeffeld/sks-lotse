import { useState, type FormEvent } from 'react'

import { ApiError, apiClient } from '../api/client'
import type { AdminMfaEnrolment } from '../api/types'
import { useAsyncAction } from '../hooks/useAsyncAction'
import { formStyles } from './formStyles'

const f = formStyles('light')

interface Props {
  // Called once the backend accepted a code and re-issued the session with it.
  onVerified: () => void
}

function codeError(err: unknown) {
  if (err instanceof ApiError && err.status === 400) return 'Der Code ist ungültig. Bitte den aktuellen Code eingeben.'
  if (err instanceof ApiError && err.status === 429) return 'Zu viele Versuche. Bitte in ein paar Minuten erneut.'
  return 'Die Prüfung ist fehlgeschlagen. Bitte erneut versuchen.'
}

// The 6-digit field both screens share; spaces (as some apps show the code, "123 456") are dropped.
function CodeForm({ onVerified, submitLabel }: Props & { submitLabel: string }) {
  const [code, setCode] = useState('')
  const { run, isPending, error } = useAsyncAction()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await run(async () => {
      await apiClient.post('/admin/mfa/verify', { code })
      onVerified()
    }, codeError)
  }

  return (
    <form className="flex max-w-xs flex-col gap-4" onSubmit={handleSubmit}>
      <label className={f.label} htmlFor="totp-code">
        Code aus der Authenticator-App
        <input
          id="totp-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={7}
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\s/g, ''))}
          className={`${f.input} font-mono tracking-widest`}
        />
      </label>
      {error ? (
        <p role="alert" className={f.error}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={isPending} className={f.button}>
        {submitLabel}
      </button>
    </form>
  )
}

// First visit to /admin: create the secret, show it as QR code (and as text for typing in), and
// switch 2FA on with the first code the app shows.
export function AdminMfaEnrol({ onVerified }: Props) {
  const [enrolment, setEnrolment] = useState<AdminMfaEnrolment | null>(null)
  const { run, isPending, error } = useAsyncAction()

  function start() {
    void run(async () => {
      setEnrolment(await apiClient.post<AdminMfaEnrolment>('/admin/mfa/enrol'))
    }, 'Die Einrichtung konnte nicht gestartet werden. Bitte erneut versuchen.')
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl text-ink">Zwei-Faktor-Anmeldung einrichten</h2>
      <p className="max-w-prose text-sm text-ink-soft">
        Der Admin-Bereich ist zusätzlich durch einen Code aus einer Authenticator-App geschützt (z. B. Authy, Google
        Authenticator). Die Einrichtung ist einmalig; danach fragt der Admin-Bereich alle 12 Stunden nach einem Code.
      </p>
      {enrolment === null ? (
        <>
          {error ? (
            <p role="alert" className={`${f.error} max-w-xs`}>
              {error}
            </p>
          ) : null}
          <button type="button" onClick={start} disabled={isPending} className={`${f.button} self-start`}>
            Einrichtung starten
          </button>
        </>
      ) : (
        <>
          <ol className="flex max-w-prose list-decimal flex-col gap-2 pl-5 text-sm text-ink-soft">
            <li>QR-Code mit der Authenticator-App scannen.</li>
            <li>Den angezeigten 6-stelligen Code unten eingeben.</li>
          </ol>
          <img
            src={enrolment.qr_code}
            alt="QR-Code für die Authenticator-App"
            width={200}
            height={200}
            className="rounded-tile border border-border bg-white"
          />
          <p className="text-sm text-ink-soft">
            Scannen nicht möglich? Diesen Schlüssel von Hand eingeben:{' '}
            <code className="font-mono break-all text-ink">{enrolment.secret}</code>
          </p>
          <CodeForm onVerified={onVerified} submitLabel="Aktivieren" />
        </>
      )}
    </section>
  )
}

// Every later visit (and after 12 hours): one code opens the admin area for this session.
export function AdminMfaVerify({ onVerified }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl text-ink">Code bestätigen</h2>
      <p className="max-w-prose text-sm text-ink-soft">
        Für den Admin-Bereich bitte den aktuellen Code aus deiner Authenticator-App eingeben.
      </p>
      <CodeForm onVerified={onVerified} submitLabel="Bestätigen" />
    </section>
  )
}
